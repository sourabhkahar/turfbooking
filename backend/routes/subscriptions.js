const express = require('express');
const db = require('../config/db');
const { authenticate, requireOwner } = require('../middleware/auth');
const { razorpay, verifyPaymentSignature, toPaise } = require('../services/razorpay');
const svc = require('../services/subscriptionService');

const router = express.Router();

// GET /api/subscriptions/plans — public list of active plans
router.get('/plans', async (req, res) => {
    try {
        res.json(await svc.listPlans());
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/subscriptions/status — current plan, limits, usage, trial eligibility, upcoming periods
router.get('/status', authenticate, requireOwner, async (req, res) => {
    try {
        const current = await svc.getActiveSubscription(req.user.id);
        const [[{ turfs_used }]] = await db.query(
            "SELECT COUNT(*) AS turfs_used FROM turfs WHERE owner_id = ? AND status <> 'deleted'", [req.user.id]
        );
        const [upcoming] = await db.query(
            `SELECT s.id, s.plan_name, s.start_date, s.end_date FROM owner_subscriptions s
             WHERE s.owner_id = ? AND s.status = 'active' AND s.start_date > NOW() ORDER BY s.start_date`,
            [req.user.id]
        );
        res.json({
            is_subscribed: !!current,
            subscription: current,
            usage: { turfs_used, max_turfs: current?.max_turfs ?? 0 },
            trial: await svc.trialStatus(req.user.id),
            upcoming,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/subscriptions/trial — start the one-time free trial
router.post('/trial', authenticate, requireOwner, async (req, res) => {
    try {
        const { plan, end_date } = await svc.startTrial(req.user.id);
        res.json({ message: `Free trial of ${plan.name} started`, end_date });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/subscriptions/subscribe { plan_id } — creates the Razorpay order + a pending row
router.post('/subscribe', authenticate, requireOwner, async (req, res) => {
    try {
        let plan;
        if (req.body.plan_id) {
            [[plan]] = await db.query('SELECT * FROM plans WHERE id = ? AND is_active = 1', [req.body.plan_id]);
        } else {
            [[plan]] = await db.query("SELECT * FROM plans WHERE code = 'pro_monthly' AND is_active = 1"); // old clients
        }
        if (!plan) return res.status(404).json({ message: 'Plan not found' });

        // Downgrading below current usage would immediately lock the owner out of their turfs
        const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM turfs WHERE owner_id = ? AND status <> 'deleted'", [req.user.id]);
        if (plan.max_turfs != null && n > plan.max_turfs) {
            return res.status(409).json({ message: `You have ${n} turfs; ${plan.name} allows ${plan.max_turfs}. Choose a bigger plan.` });
        }

        const order = await razorpay.orders.create({
            amount: toPaise(plan.price),
            currency: 'INR',
            receipt: `sub_${req.user.id}_${Date.now()}`,
            notes: { type: 'subscription', owner_id: String(req.user.id), plan: plan.code },
        });
        await svc.createPendingSubscription(req.user.id, plan, order.id);
        res.json({ ...order, plan });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error creating subscription order' });
    }
});

// POST /api/subscriptions/verify — one order activates one period, once
router.post('/verify', authenticate, requireOwner, async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
        return res.status(400).json({ message: 'Invalid signature' });
    }
    try {
        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        if (payment.order_id !== razorpay_order_id || !['captured', 'authorized'].includes(payment.status)) {
            return res.status(400).json({ message: 'Payment not completed for this order' });
        }
        const { activated, subscription } = await svc.activateSubscription({
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            amountPaise: payment.amount,
            ownerId: req.user.id,
        });
        const startsLater = new Date(subscription.start_date) > new Date(Date.now() + 60000);
        res.json({
            message: !activated ? 'Subscription already active'
                : startsLater ? `Paid. ${subscription.plan_name} starts when your current plan ends.`
                : 'Subscription activated successfully!',
            subscription,
        });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        console.error(err);
        res.status(500).json({ message: 'Server error during verification' });
    }
});

module.exports = router;
