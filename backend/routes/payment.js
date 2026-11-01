const express = require('express');
const db = require('../config/db');
const { authenticate, requireOwner } = require('../middleware/auth');
const { sendBookingConfirmation } = require('../services/notificationService');
const { razorpay, verifyPaymentSignature } = require('../services/razorpay');
const { amountDuePaise, confirmOrder } = require('../services/bookingPayments');
const { getPlatformFeePercent } = require('../services/settings');
const { settlementMode } = require('../services/settlement');

const router = express.Router();

const parseIds = (body) => {
    const raw = Array.isArray(body.bookingIds) ? body.bookingIds : [body.bookingId];
    const ids = [...new Set(raw.map((x) => parseInt(x, 10)).filter((x) => Number.isInteger(x) && x > 0))];
    return ids.length > 0 && ids.length <= 24 ? ids : null;
};

// POST /api/payment/create-order
// The amount is computed on the server from the bookings; any client "amount" is ignored.
router.post('/create-order', authenticate, async (req, res) => {
    try {
        const ids = parseIds(req.body);
        if (!ids) return res.status(400).json({ message: 'Invalid booking IDs' });

        const [bookings] = await db.query(
            `SELECT b.*, t.part_payment_percentage, t.owner_id
             FROM bookings b JOIN turfs t ON b.turf_id = t.id
             WHERE b.id IN (?) AND b.user_id = ?`,
            [ids, req.user.id]
        );
        if (bookings.length !== ids.length) return res.status(404).json({ message: 'Booking not found' });
        if (bookings.some((b) => b.status !== 'pending')) {
            return res.status(409).json({ message: 'One or more bookings are no longer awaiting payment' });
        }
        if (new Set(bookings.map((b) => b.turf_id)).size !== 1) {
            return res.status(400).json({ message: 'All bookings in one payment must be for the same turf' });
        }

        const amountPaise = amountDuePaise(bookings);
        if (amountPaise < 100) return res.status(400).json({ message: 'Amount must be at least ₹1' });

        const options = {
            amount: amountPaise,
            currency: 'INR',
            receipt: `bk_${ids[0]}_${Date.now()}`,
            notes: { booking_ids: ids.join(','), user_id: String(req.user.id) },
        };

        // Route settlement: split the owner's share out of this payment instantly.
        let settlement = 'payout';
        if (settlementMode() === 'route') {
            const [[owner]] = await db.query('SELECT razorpay_linked_account_id FROM users WHERE id = ?', [bookings[0].owner_id]);
            if (!owner?.razorpay_linked_account_id) {
                return res.status(409).json({ message: 'This turf is not accepting online payments yet. Please contact the venue.' });
            }
            const feePercent = await getPlatformFeePercent();
            const ownerShare = amountPaise - Math.round((amountPaise * feePercent) / 100);
            if (ownerShare > 0) {
                options.transfers = [{
                    account: owner.razorpay_linked_account_id,
                    amount: ownerShare,
                    currency: 'INR',
                    notes: { booking_ids: ids.join(','), purpose: 'turf_booking' },
                    linked_account_notes: ['booking_ids'],
                    on_hold: 0,
                }];
            }
            settlement = 'route';
        }

        const order = await razorpay.orders.create(options);
        await db.query('UPDATE bookings SET razorpay_order_id = ?, settlement_method = ? WHERE id IN (?) AND user_id = ?', [order.id, settlement, ids, req.user.id]);
        res.json(order);
    } catch (err) {
        console.error('Razorpay Order Creation Error:', err);
        res.status(500).json({ message: 'Error creating payment order' });
    }
});

// POST /api/payment/verify
// Trusts only Razorpay: signature, then the payment fetched from Razorpay (order + amount + status).
router.post('/verify', authenticate, async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ message: 'Missing payment details' });
    }
    if (!verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
        return res.status(400).json({ message: 'Invalid payment signature' });
    }

    try {
        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        if (payment.order_id !== razorpay_order_id || !['captured', 'authorized'].includes(payment.status)) {
            return res.status(400).json({ message: 'Payment not completed for this order' });
        }

        const { newlyConfirmed } = await confirmOrder({
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            amountPaise: payment.amount,
            userId: req.user.id,
        });

        for (const id of newlyConfirmed) {
            sendBookingConfirmation(id).catch((e) => console.error('Email error:', e.message));
        }
        res.json({ message: 'Payment verified successfully' });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        console.error('Razorpay Verification Error:', err);
        res.status(500).json({ message: 'Internal server error during verification' });
    }
});

// PATCH /api/payment/mark-as-paid/:bookingId (owner records the cash balance)
router.patch('/mark-as-paid/:bookingId', authenticate, requireOwner, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT b.id, b.status, t.owner_id FROM bookings b JOIN turfs t ON b.turf_id = t.id WHERE b.id = ?`,
            [req.params.bookingId]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Booking not found' });
        if (rows[0].owner_id !== req.user.id && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: 'Not your booking' });
        }
        if (rows[0].status !== 'confirmed') {
            return res.status(409).json({ message: 'Only confirmed bookings can be marked as paid' });
        }

        await db.query(
            `UPDATE bookings SET payment_status = 'fully_paid', paid_amount = total_amount, remaining_amount = 0,
                    payment_method = 'mixed', cash_payment_received = TRUE
             WHERE id = ?`,
            [req.params.bookingId]
        );
        res.json({ message: 'Booking marked as fully paid via cash' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
