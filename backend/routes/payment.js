const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const db = require('../config/db');
const { authenticate, requireOwner } = require('../middleware/auth');
const { sendBookingConfirmation } = require('../services/notificationService');

const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
});

// POST /api/payment/create-order
router.post('/create-order', authenticate, async (req, res) => {
    try {
        const { amount, bookingId } = req.body; // amount in INR

        const options = {
            amount: Math.round(amount * 100), // convert to paise
            currency: 'INR',
            receipt: `rcpt_${bookingId}_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);

        // Update booking with order ID
        await db.query('UPDATE bookings SET razorpay_order_id = ? WHERE id = ?', [order.id, bookingId]);

        res.json(order);
    } catch (err) {
        console.error('Razorpay Order Creation Error:', err);
        res.status(500).json({ message: 'Error creating payment order' });
    }
});

// POST /api/payment/verify
router.post('/verify', authenticate, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret')
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            // Payment verified
            const [rows] = await db.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
            if (rows.length === 0) return res.status(404).json({ message: 'Booking not found' });

            const booking = rows[0];
            const isFull = booking.total_amount === booking.remaining_amount; // If it was the first payment and full

            // Update booking status
            await db.query(`
                UPDATE bookings 
                SET payment_status = ?, 
                    paid_amount = paid_amount + remaining_amount, 
                    remaining_amount = 0,
                    payment_id = ?,
                    status = 'confirmed'
                WHERE id = ?
            `, [
                'fully_paid',
                razorpay_payment_id,
                bookingId
            ]);

            // If it was just confirmed, send email
            await sendBookingConfirmation(bookingId);

            return res.json({ message: "Payment verified successfully" });
        } else {
            return res.status(400).json({ message: "Invalid signature sent!" });
        }
    } catch (err) {
        console.error('Razorpay Verification Error:', err);
        res.status(500).json({ message: 'Internal server error during verification' });
    }
});

// PATCH /api/payment/mark-as-paid/:bookingId (Owner marks cash payment)
router.patch('/mark-as-paid/:bookingId', authenticate, requireOwner, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const [rows] = await db.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);

        if (rows.length === 0) return res.status(404).json({ message: 'Booking not found' });

        const booking = rows[0];

        // Update to fully paid via cash
        await db.query(`
            UPDATE bookings 
            SET payment_status = 'fully_paid', 
                paid_amount = total_amount, 
                remaining_amount = 0,
                payment_method = 'mixed',
                cash_payment_received = TRUE
            WHERE id = ?
        `, [bookingId]);

        res.json({ message: 'Booking marked as fully paid via cash' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
