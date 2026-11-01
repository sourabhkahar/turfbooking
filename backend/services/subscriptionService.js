// Owner subscriptions v2: plans (tiers × monthly/annual), one-time free trial,
// replay-safe activation, and the limits each plan grants.
const db = require('../config/db');
const { toPaise } = require('./razorpay');
const { PaymentError } = require('./bookingPayments');

const TIER_RANK = { starter: 1, pro: 2 };
// Limits for subscriptions bought before plans existed (plan_id NULL): treated as Pro.
const LEGACY_LIMITS = { tier: 'pro', max_turfs: 5, allow_booking_links: 1 };

// SQL fragment: turf t's owner has a running subscription right now.
const ACTIVE_OWNER_SQL = `EXISTS (SELECT 1 FROM owner_subscriptions os WHERE os.owner_id = t.owner_id
    AND os.status = 'active' AND os.start_date <= NOW() AND os.end_date > NOW())`;

async function getSetting(key, fallback) {
    try {
        const [[row]] = await db.query('SELECT setting_value FROM app_settings WHERE setting_key = ?', [key]);
        return row?.setting_value ?? fallback;
    } catch { return fallback; }
}

async function listPlans({ includeInactive = false } = {}) {
    const [plans] = await db.query(
        `SELECT * FROM plans ${includeInactive ? '' : 'WHERE is_active = 1'} ORDER BY sort_order, price`
    );
    return plans;
}

// The subscription in force right now (highest tier wins if periods overlap), with its limits.
async function getActiveSubscription(ownerId, conn = db) {
    const [[sub]] = await conn.query(
        `SELECT s.*, p.code AS plan_code, p.tier, p.billing_interval, p.max_turfs, p.allow_booking_links
         FROM owner_subscriptions s LEFT JOIN plans p ON s.plan_id = p.id
         WHERE s.owner_id = ? AND s.status = 'active' AND s.start_date <= NOW() AND s.end_date > NOW()
         ORDER BY FIELD(COALESCE(p.tier, 'pro'), 'starter', 'pro') DESC, s.end_date DESC LIMIT 1`,
        [ownerId]
    );
    if (!sub) return null;
    if (!sub.plan_id) Object.assign(sub, LEGACY_LIMITS);
    return sub;
}

async function trialStatus(ownerId) {
    const [[{ n }]] = await db.query(
        "SELECT COUNT(*) AS n FROM owner_subscriptions WHERE owner_id = ? AND (is_trial = 1 OR status = 'active')",
        [ownerId]
    );
    const days = parseInt(await getSetting('trial_days', '14'), 10) || 0;
    return { eligible: n === 0 && days > 0, days, plan_code: await getSetting('trial_plan_code', 'pro_monthly') };
}

// One free trial per owner, only before their first subscription.
async function startTrial(ownerId) {
    const t = await trialStatus(ownerId);
    if (!t.eligible) throw new PaymentError(409, 'Free trial is not available for this account');
    const [[plan]] = await db.query('SELECT * FROM plans WHERE code = ?', [t.plan_code]);
    if (!plan) throw new PaymentError(500, 'Trial plan is not configured');
    const end = new Date();
    end.setDate(end.getDate() + t.days);
    await db.query(
        `INSERT INTO owner_subscriptions (owner_id, plan_id, plan_name, amount, status, is_trial, start_date, end_date)
         VALUES (?, ?, ?, 0, 'active', 1, NOW(), ?)`,
        [ownerId, plan.id, `${plan.name} (free trial)`, end]
    );
    return { plan, end_date: end };
}

// Creates the pending row tied to a Razorpay order. The plan's price is copied so later
// price changes don't affect an order already being paid.
async function createPendingSubscription(ownerId, plan, orderId) {
    await db.query(
        `INSERT INTO owner_subscriptions (owner_id, plan_id, plan_name, amount, status, start_date, end_date, razorpay_order_id)
         VALUES (?, ?, ?, ?, 'pending', NOW(), NOW(), ?)`,
        [ownerId, plan.id, plan.name, plan.price, orderId]
    );
}

// Activates the pending row for this order. Idempotent and replay-safe.
// Timing: ends a running trial and starts now; an upgrade to a higher tier starts now;
// the same tier or a downgrade is queued after the current period ends.
async function activateSubscription({ orderId, paymentId, amountPaise, ownerId = null }) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [[sub]] = await conn.query(
            `SELECT s.*, p.tier, p.billing_interval FROM owner_subscriptions s LEFT JOIN plans p ON s.plan_id = p.id
             WHERE s.razorpay_order_id = ? FOR UPDATE`, [orderId]
        );
        if (!sub) throw new PaymentError(404, 'Subscription order not found');
        if (ownerId && sub.owner_id !== ownerId) throw new PaymentError(403, 'Order does not belong to you');
        if (sub.status === 'active') { await conn.commit(); return { activated: false, subscription: sub }; }
        if (Number(amountPaise) !== toPaise(sub.amount)) throw new PaymentError(400, 'Paid amount does not match plan amount');

        const current = await getActiveSubscription(sub.owner_id, conn);
        const newTier = sub.tier || 'pro';
        let start = new Date();
        if (current?.is_trial) {
            await conn.query("UPDATE owner_subscriptions SET end_date = NOW() WHERE owner_id = ? AND is_trial = 1 AND end_date > NOW()", [sub.owner_id]);
        } else if (current && TIER_RANK[newTier] <= TIER_RANK[current.tier || 'pro']) {
            const [[latest]] = await conn.query(
                "SELECT MAX(end_date) AS end_date FROM owner_subscriptions WHERE owner_id = ? AND status = 'active' AND is_trial = 0 AND end_date > NOW()",
                [sub.owner_id]
            );
            if (latest?.end_date) start = new Date(latest.end_date);
        }
        const end = new Date(start);
        if (sub.billing_interval === 'year') end.setFullYear(end.getFullYear() + 1);
        else end.setMonth(end.getMonth() + 1);

        await conn.query(
            "UPDATE owner_subscriptions SET status = 'active', start_date = ?, end_date = ?, razorpay_payment_id = ? WHERE id = ?",
            [start, end, paymentId, sub.id]
        );
        await conn.commit();
        return { activated: true, subscription: { ...sub, status: 'active', start_date: start, end_date: end } };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

module.exports = {
    ACTIVE_OWNER_SQL, TIER_RANK, listPlans, getActiveSubscription, trialStatus, startTrial,
    createPendingSubscription, activateSubscription,
};
