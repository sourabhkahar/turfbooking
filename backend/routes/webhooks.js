// Razorpay webhook: the source of truth when the browser never calls /verify
// (tab closed, network drop). Must be mounted with express.raw() BEFORE express.json().
// Dashboard → Settings → Webhooks: URL https://<api-domain>/api/webhooks/razorpay,
// events: payment.captured, payout.processed, payout.failed, payout.reversed, payout.rejected
const express = require('express');
const db = require('../config/db');
const { verifyWebhookSignature } = require('../services/razorpay');
const { confirmOrder } = require('../services/bookingPayments');
const { activateSubscription } = require('../services/subscriptionService');
const { markPayout } = require('../services/payoutService');
const { sendBookingConfirmation } = require('../services/notificationService');

const router = express.Router();

router.post('/razorpay', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    if (!Buffer.isBuffer(req.body) || !verifyWebhookSignature(req.body, signature)) {
        return res.status(400).json({ message: 'Invalid signature' });
    }

    let event;
    try { event = JSON.parse(req.body.toString('utf8')); } catch { return res.status(400).end(); }

    try {
        if (event.event === 'payment.captured') {
            const p = event.payload.payment.entity;
            const [[isSub]] = await db.query('SELECT id FROM owner_subscriptions WHERE razorpay_order_id = ?', [p.order_id]);
            if (isSub) {
                await activateSubscription({ orderId: p.order_id, paymentId: p.id, amountPaise: p.amount });
            } else {
                const { newlyConfirmed } = await confirmOrder({ orderId: p.order_id, paymentId: p.id, amountPaise: p.amount });
                for (const id of newlyConfirmed) sendBookingConfirmation(id).catch(() => {});
            }
        } else if (event.event?.startsWith('payout.')) {
            const po = event.payload.payout.entity;
            const [[row]] = await db.query('SELECT id FROM payouts WHERE razorpay_payout_id = ? OR transaction_ref = ?', [po.id, po.reference_id]);
            if (row) {
                if (event.event === 'payout.processed') await markPayout(row.id, 'processed', { rzpPayoutId: po.id });
                if (['payout.failed', 'payout.reversed', 'payout.rejected'].includes(event.event)) {
                    await markPayout(row.id, 'failed', { rzpPayoutId: po.id, failureReason: po.status_details?.description || event.event });
                }
            }
        }
        res.json({ ok: true });
    } catch (err) {
        // 4xx business errors (amount mismatch, not pending) are logged and acknowledged so Razorpay
        // stops retrying; anything else returns 500 so Razorpay retries later.
        if (err.status && err.status < 500) {
            console.error(`[webhook] ${event.event}: ${err.message}`);
            return res.json({ ok: false, message: err.message });
        }
        console.error('[webhook] error:', err);
        res.status(500).json({ message: 'Webhook processing failed' });
    }
});

module.exports = router;
