const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const db = require('../config/db');
const { authenticate, requireOwner } = require('../middleware/auth');

const router = express.Router();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
});

const SUB_AMOUNT = 999; // Simple fixed monthly plan

// GET /api/subscriptions/status - Check current status
router.get('/status', authenticate, requireOwner, async (req, res) => {
    try {
        const [subs] = await db.query(
            "SELECT * FROM owner_subscriptions WHERE owner_id = ? AND status = 'active' AND end_date > NOW() ORDER BY end_date DESC LIMIT 1",
            [req.user.id]
        );
        res.json({
            is_subscribed: subs.length > 0,
            subscription: subs[0] || null
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/subscriptions/subscribe - Initialize subscription payment
router.post('/subscribe', authenticate, requireOwner, async (req, res) => {
    try {
        const options = {
            amount: SUB_AMOUNT * 100,
            currency: 'INR',
            receipt: `sub_${req.user.id}_${Date.now()}`,
        };
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error creating subscription order' });
    }
});

// POST /api/subscriptions/verify - Verify payment and activate subscription
router.post('/verify', authenticate, requireOwner, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret')
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            const start_date = new Date();
            const end_date = new Date();
            end_date.setMonth(end_date.getMonth() + 1);

            await db.query(`
                INSERT INTO owner_subscriptions (owner_id, plan_name, amount, status, start_date, end_date, razorpay_order_id, razorpay_payment_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [req.user.id, 'Monthly Pro', SUB_AMOUNT, 'active', start_date, end_date, razorpay_order_id, razorpay_payment_id]);

            res.json({ message: 'Subscription activated successfuly!' });
        } else {
            res.status(400).json({ message: 'Invalid signature' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error during verification' });
    }
});

module.exports = router;
