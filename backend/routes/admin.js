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
    try {
        await db.query('INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', [key, value, value]);
        res.json({ message: 'Setting updated' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/admin/auto-payout — trigger auto payout for all eligible owners
router.post('/auto-payout', authenticate, requireAdmin, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Get all owners with pending earnings
        const [pendingOwners] = await conn.query(`
            SELECT u.id as owner_id, SUM(b.total_amount) as total_pending
            FROM users u
            JOIN turfs t ON u.id = t.owner_id
            JOIN bookings b ON t.id = b.turf_id
            WHERE b.status = 'confirmed' AND b.payment_status = 'fully_paid' AND b.payout_id IS NULL
            GROUP BY u.id
            HAVING total_pending > 0
        `);

        if (pendingOwners.length === 0) {
            await conn.rollback();
            return res.json({ message: 'No pending payouts to process' });
        }

        const ref = `AUTO-PAY-${Date.now()}`;
        const processedIds = [];

        for (const owner of pendingOwners) {
            // Create Payout
            const [result] = await conn.query(`
                INSERT INTO payouts (owner_id, amount, final_amount, status, period_start, period_end, processed_at, transaction_ref, payout_type)
                VALUES (?, ?, ?, 'processed', NOW(), NOW(), NOW(), ?, 'auto')
            `, [owner.owner_id, owner.total_pending, owner.total_pending, ref]);

            const payoutId = result.insertId;

            // Link bookings
            await conn.query(`
                UPDATE bookings 
                SET payout_id = ?
                WHERE payout_id IS NULL AND status = 'confirmed' AND payment_status = 'fully_paid'
                AND turf_id IN (SELECT id FROM turfs WHERE owner_id = ?)
            `, [payoutId, owner.owner_id]);
            
            processedIds.push(owner.owner_id);
        }

        await conn.commit();
        res.json({ message: `Automated payout completed for ${processedIds.length} owners`, ref });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ message: 'Error processing automated payouts' });
    } finally {
        conn.release();
    }
});

module.exports = router;

