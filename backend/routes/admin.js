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

        res.json({ total_users, total_owners, total_turfs, pending_turfs, total_bookings, total_revenue });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/admin/users — list all users
router.get('/users', authenticate, requireAdmin, async (req, res) => {
    try {
        const { role, status } = req.query;
        let query = 'SELECT id, name, email, role, phone, status, created_at FROM users WHERE 1=1';
        const params = [];
        if (role) { query += ' AND role = ?'; params.push(role); }
        if (status) { query += ' AND status = ?'; params.push(status); }
        query += ' ORDER BY created_at DESC';
        const [users] = await db.query(query, params);
        res.json(users);
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

// GET /api/admin/turfs — all turfs with optional status filter
router.get('/turfs', authenticate, requireAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        let query = `SELECT t.*, u.name as owner_name, u.email as owner_email
                 FROM turfs t JOIN users u ON t.owner_id = u.id`;
        const params = [];
        if (status) { query += ' WHERE t.status = ?'; params.push(status); }
        query += ' ORDER BY t.created_at DESC';
        const [turfs] = await db.query(query, params);
        res.json(turfs);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
