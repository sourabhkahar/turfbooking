const express = require('express');
const db = require('../config/db');
const { authenticate, requireOwner, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 1. OWNER ROUTES

// GET /api/payouts/owner/stats - Earnings summary for owner
router.get('/owner/stats', authenticate, requireOwner, async (req, res) => {
    try {
        // Pending earnings (confirmed bookings not yet linked to a payout)
        const [[{ pending_earnings }]] = await db.query(`
            SELECT COALESCE(SUM(total_amount), 0) as pending_earnings 
            FROM bookings 
            WHERE turf_id IN (SELECT id FROM turfs WHERE owner_id = ?)
            AND status = 'confirmed' AND payment_status = 'fully_paid' AND payout_id IS NULL
        `, [req.user.id]);

        // Total received so far
        const [[{ total_payouts }]] = await db.query(`
            SELECT COALESCE(SUM(final_amount), 0) as total_payouts
            FROM payouts WHERE owner_id = ? AND status = 'processed'
        `, [req.user.id]);

        // List individual confirmed transactions (all history)
        const [transactions] = await db.query(`
            SELECT b.id, b.total_amount, b.booking_date, b.payment_status, b.payout_id, t.name as turf_name,
                   p.status as payout_status, p.processed_at
            FROM bookings b
            JOIN turfs t ON b.turf_id = t.id
            LEFT JOIN payouts p ON b.payout_id = p.id
            WHERE t.owner_id = ? AND b.status = 'confirmed'
            ORDER BY b.created_at DESC LIMIT 100
        `, [req.user.id]);

        res.json({ pending_earnings, total_payouts, transactions });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// 2. ADMIN ROUTES

// GET /api/payouts/admin/pending - Admin sees who needs payout with pagination
router.get('/admin/pending', authenticate, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const [[{ total }]] = await db.query(`
            SELECT COUNT(DISTINCT u.id) as total
            FROM users u
            JOIN turfs t ON u.id = t.owner_id
            JOIN bookings b ON t.id = b.turf_id
            WHERE b.status = 'confirmed' AND b.payment_status = 'fully_paid' AND b.payout_id IS NULL
        `);

        const [pending] = await db.query(`
            SELECT u.id as owner_id, u.name as owner_name, u.email as owner_email,
                   COUNT(b.id) as booking_count,
                   SUM(b.total_amount) as total_pending
            FROM users u
            JOIN turfs t ON u.id = t.owner_id
            JOIN bookings b ON t.id = b.turf_id
            WHERE b.status = 'confirmed' AND b.payment_status = 'fully_paid' AND b.payout_id IS NULL
            GROUP BY u.id
            HAVING total_pending > 0
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        res.json({
            data: pending,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/payouts/admin/process - Admin confirms payment release
router.post('/admin/process', authenticate, requireAdmin, async (req, res) => {
    const { owner_id, amount, transaction_ref } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Create Payout record
        const [result] = await conn.query(`
            INSERT INTO payouts (owner_id, amount, final_amount, status, period_start, period_end, processed_at, transaction_ref)
            VALUES (?, ?, ?, 'processed', NOW(), NOW(), NOW(), ?)
        `, [owner_id, amount, amount, transaction_ref]);

        const payoutId = result.insertId;

        // 2. Link all currently confirm-but-unpaid bookings for this owner to this payout
        await conn.query(`
            UPDATE bookings 
            SET payout_id = ?
            WHERE payout_id IS NULL AND status = 'confirmed' AND payment_status = 'fully_paid'
            AND turf_id IN (SELECT id FROM turfs WHERE owner_id = ?)
        `, [payoutId, owner_id]);

        await conn.commit();
        res.json({ message: 'Payout processed successfully', payout_id: payoutId });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    } finally {
        conn.release();
    }
});

module.exports = router;
