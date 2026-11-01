const express = require('express');
const db = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/admin/stats — dashboard stats
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
    try {
        const [[{ total_users }]] = await db.query("SELECT COUNT(*) as total_users FROM users WHERE role = 'user'");
        const [[{ total_owners }]] = await db.query("SELECT COUNT(*) as total_owners FROM users WHERE role = 'owner'");
        const [[{ total_turfs }]] = await db.query("SELECT COUNT(*) as total_turfs FROM turfs");
        const [[{ pending_turfs }]] = await db.query("SELECT COUNT(*) as pending_turfs FROM turfs WHERE status = 'pending'");
        const [[{ total_bookings }]] = await db.query("SELECT COUNT(*) as total_bookings FROM bookings WHERE status = 'confirmed'");
        const [[{ total_revenue }]] = await db.query("SELECT COALESCE(SUM(total_amount),0) as total_revenue FROM bookings WHERE status = 'confirmed'");

        const [daily] = await db.query(`
            SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as booking_date, 
                   SUM(total_amount) as revenue, 
                   COUNT(*) as count 
            FROM bookings 
            WHERE status = 'confirmed' 
            GROUP BY DATE(booking_date) 
            ORDER BY booking_date ASC 
            LIMIT 14
        `);

        const [bySport] = await db.query(`
            SELECT sport_type, COUNT(*) as count 
            FROM turfs 
            GROUP BY sport_type
        `);

        res.json({ 
            summary: {
                total_users,
                total_owners,
                total_turfs,
                pending_turfs,
                total_bookings,
                total_revenue
            },
            charts: {
                daily,
                by_sport: bySport
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/admin/users — list all users with pagination
router.get('/users', authenticate, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const { role, status } = req.query;

        let query = 'SELECT id, name, email, role, phone, status, created_at FROM users WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
        const params = [];
        const countParams = [];

        if (role) { 
            query += ' AND role = ?'; params.push(role);
            countQuery += ' AND role = ?'; countParams.push(role);
        }
        if (status) { 
            query += ' AND status = ?'; params.push(status);
            countQuery += ' AND status = ?'; countParams.push(status);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [[{ total }]] = await db.query(countQuery, countParams);
        const [users] = await db.query(query, params);

        res.json({
            data: users,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PATCH /api/admin/users/:id/status — enable or disable a user
router.patch('/users/:id/status', authenticate, requireAdmin, async (req, res) => {
    const { status } = req.body;
    if (!['active', 'disabled'].includes(status)) return res.status(400).json({ message: 'Status must be active or disabled' });
    try {
        const [user] = await db.query('SELECT id, role FROM users WHERE id = ?', [req.params.id]);
        if (user.length === 0) return res.status(404).json({ message: 'User not found' });
        if (user[0].role === 'super_admin') return res.status(403).json({ message: 'Cannot disable super admin' });

        await db.query('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ message: `User ${status}` });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/admin/turfs — all turfs with optional status filter and pagination
router.get('/turfs', authenticate, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const { status } = req.query;

        let query = `SELECT t.*, u.name as owner_name, u.email as owner_email
                 FROM turfs t JOIN users u ON t.owner_id = u.id`;
        let countQuery = `SELECT COUNT(*) as total FROM turfs t JOIN users u ON t.owner_id = u.id`;
        const params = [];
        const countParams = [];

        if (status) { 
            query += ' WHERE t.status = ?'; params.push(status);
            countQuery += ' WHERE t.status = ?'; countParams.push(status);
        }

        query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [[{ total }]] = await db.query(countQuery, countParams);
        const [turfs] = await db.query(query, params);

        res.json({
            data: turfs,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/admin/settings — get all settings
router.get('/settings', authenticate, requireAdmin, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM app_settings');
        const settings = rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
        res.json(settings);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PATCH /api/admin/settings — update a setting
router.patch('/settings', authenticate, requireAdmin, async (req, res) => {
    const { key, value } = req.body;
    const ALLOWED = { payout_mode: (v) => ['manual', 'auto'].includes(v), platform_fee_percent: (v) => !Number.isNaN(parseFloat(v)) && parseFloat(v) >= 0 && parseFloat(v) < 50 };
    if (!ALLOWED[key] || !ALLOWED[key](String(value))) return res.status(400).json({ message: 'Invalid setting' });
    try {
        await db.query('INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', [key, value, value]);
        res.json({ message: 'Setting updated' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/admin/auto-payout — pay all eligible owners through the same RazorpayX path
router.post('/auto-payout', authenticate, requireAdmin, async (req, res) => {
    try {
        const { processAllPayouts } = require('../services/payoutService');
        const results = await processAllPayouts('auto');
        if (results.length === 0) return res.json({ message: 'No pending payouts to process', results });
        const ok = results.filter((r) => r.status !== 'failed').length;
        res.json({ message: `Automated payout initiated for ${ok} of ${results.length} owners`, results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error processing automated payouts' });
    }
});

// ─── Subscription plans ───────────────────────────────────────────────────────
const PLAN_FIELDS = ['name', 'tier', 'billing_interval', 'price', 'max_turfs', 'allow_booking_links', 'is_active', 'sort_order'];

function validatePlan(b, partial) {
    const errs = [];
    const has = (k) => b[k] !== undefined;
    if ((!partial || has('name')) && !String(b.name || '').trim()) errs.push('name is required');
    if ((!partial || has('tier')) && !['starter', 'pro'].includes(b.tier)) errs.push('tier must be starter or pro');
    if ((!partial || has('billing_interval')) && !['month', 'year'].includes(b.billing_interval)) errs.push('billing_interval must be month or year');
    if ((!partial || has('price')) && !(Number(b.price) >= 1)) errs.push('price must be at least 1');
    if (has('max_turfs') && b.max_turfs !== null && !(Number.isInteger(Number(b.max_turfs)) && Number(b.max_turfs) >= 1)) errs.push('max_turfs must be a whole number ≥ 1, or null for unlimited');
    return errs;
}

// GET /api/admin/plans — all plans + trial settings
router.get('/plans', authenticate, requireAdmin, async (req, res) => {
    try {
        const [plans] = await db.query('SELECT * FROM plans ORDER BY sort_order, price');
        const [settings] = await db.query("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('trial_days', 'trial_plan_code')");
        res.json({ plans, trial: Object.fromEntries(settings.map((r) => [r.setting_key, r.setting_value])) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/admin/plans — create a plan
router.post('/plans', authenticate, requireAdmin, async (req, res) => {
    const errs = validatePlan(req.body, false);
    const code = String(req.body.code || '').trim().toLowerCase();
    if (!/^[a-z0-9_]{3,50}$/.test(code)) errs.push('code must be 3–50 lowercase letters, digits or _');
    if (errs.length) return res.status(400).json({ message: errs.join('; ') });
    try {
        const b = req.body;
        const [r] = await db.query(
            `INSERT INTO plans (code, name, tier, billing_interval, price, max_turfs, allow_booking_links, is_active, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [code, b.name.trim(), b.tier, b.billing_interval, b.price, b.max_turfs ?? null, b.allow_booking_links ? 1 : 0, b.is_active === false ? 0 : 1, b.sort_order || 0]
        );
        res.status(201).json({ message: 'Plan created', id: r.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A plan with this code already exists' });
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PATCH /api/admin/plans/:id — edit a plan (price changes apply to new purchases only)
router.patch('/plans/:id', authenticate, requireAdmin, async (req, res) => {
    const errs = validatePlan(req.body, true);
    if (errs.length) return res.status(400).json({ message: errs.join('; ') });
    const sets = [], vals = [];
    for (const k of PLAN_FIELDS) {
        if (req.body[k] === undefined) continue;
        sets.push(`${k} = ?`);
        vals.push(k === 'allow_booking_links' || k === 'is_active' ? (req.body[k] ? 1 : 0) : req.body[k]);
    }
    if (!sets.length) return res.status(400).json({ message: 'Nothing to update' });
    try {
        const [r] = await db.query(`UPDATE plans SET ${sets.join(', ')} WHERE id = ?`, [...vals, req.params.id]);
        if (!r.affectedRows) return res.status(404).json({ message: 'Plan not found' });
        res.json({ message: 'Plan updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PATCH /api/admin/trial — { trial_days, trial_plan_code }
router.patch('/trial', authenticate, requireAdmin, async (req, res) => {
    const days = parseInt(req.body.trial_days, 10);
    if (!(days >= 0 && days <= 90)) return res.status(400).json({ message: 'trial_days must be 0–90 (0 turns trials off)' });
    try {
        const code = req.body.trial_plan_code;
        if (code) {
            const [[p]] = await db.query('SELECT id FROM plans WHERE code = ?', [code]);
            if (!p) return res.status(400).json({ message: 'Unknown plan code' });
            await db.query("INSERT INTO app_settings (setting_key, setting_value) VALUES ('trial_plan_code', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)", [code]);
        }
        await db.query("INSERT INTO app_settings (setting_key, setting_value) VALUES ('trial_days', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)", [String(days)]);
        res.json({ message: 'Trial settings updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;

