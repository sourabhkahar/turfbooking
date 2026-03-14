const express = require('express');
const db = require('../config/db');
const { authenticate, requireOwner } = require('../middleware/auth');

const router = express.Router();

// GET /api/owner/stats - Comprehensive stats for owner dashboard
router.get('/stats', authenticate, requireOwner, async (req, res) => {
    try {
        const ownerId = req.user.id;
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localDate = new Date(now.getTime() - offset);
        const today = localDate.toISOString().split('T')[0];
        
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfMonth = new Date(firstDayOfMonth.getTime() - offset).toISOString().split('T')[0];

        // 1. Today's bookings count
        const [[{ today_bookings }]] = await db.query(`
            SELECT COUNT(*) as today_bookings 
            FROM bookings 
            WHERE turf_id IN (SELECT id FROM turfs WHERE owner_id = ?)
            AND booking_date = ? AND status = 'confirmed'
        `, [ownerId, today]);

        // 2. Monthly revenue (sum of paid_amount in current month)
        const [[{ monthly_revenue }]] = await db.query(`
            SELECT COALESCE(SUM(paid_amount), 0) as monthly_revenue 
            FROM bookings 
            WHERE turf_id IN (SELECT id FROM turfs WHERE owner_id = ?)
            AND booking_date >= ? AND status = 'confirmed'
        `, [ownerId, startOfMonth]);

        // 3. Total bookings count (all time)
        const [[{ total_bookings }]] = await db.query(`
            SELECT COUNT(*) as total_bookings 
            FROM bookings 
            WHERE turf_id IN (SELECT id FROM turfs WHERE owner_id = ?)
            AND status = 'confirmed'
        `, [ownerId]);

        // 4. Upcoming bookings count (from tomorrow onwards)
        const [[{ upcoming_bookings }]] = await db.query(`
            SELECT COUNT(*) as upcoming_bookings 
            FROM bookings 
            WHERE turf_id IN (SELECT id FROM turfs WHERE owner_id = ?)
            AND booking_date > ? AND status = 'confirmed'
        `, [ownerId, today]);

        // 5. Chart Data: Last 7 days bookings
        // We'll get count and revenue per day
        const [dailyStats] = await db.query(`
            SELECT booking_date, COUNT(*) as count, SUM(paid_amount) as revenue
            FROM bookings
            WHERE turf_id IN (SELECT id FROM turfs WHERE owner_id = ?)
            AND status = 'confirmed'
            AND booking_date > DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY booking_date
            ORDER BY booking_date ASC
        `, [ownerId]);

        // 6. Chart Data: Revenue by Turf
        const [turfStats] = await db.query(`
            SELECT t.name, SUM(b.paid_amount) as revenue
            FROM bookings b
            JOIN turfs t ON b.turf_id = t.id
            WHERE t.owner_id = ? AND b.status = 'confirmed'
            GROUP BY t.id
        `, [ownerId]);

        res.json({
            summary: {
                today_bookings,
                monthly_revenue,
                total_bookings,
                upcoming_bookings
            },
            charts: {
                daily: dailyStats,
                by_turf: turfStats
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/owner/billing - Subscription and financial data for owner
router.get('/billing', authenticate, requireOwner, async (req, res) => {
    try {
        const ownerId = req.user.id;

        // 1. Current Subscription
        const [subs] = await db.query(
            "SELECT plan_name, status, end_date as next_billing_at FROM owner_subscriptions WHERE owner_id = ? ORDER BY end_date DESC LIMIT 1",
            [ownerId]
        );
        const subscription = subs[0] || { plan_name: 'No Active Plan', status: 'inactive', next_billing_at: new Date() };

        // 2. Financial Stats
        const [[{ pending_payout }]] = await db.query(`
            SELECT COALESCE(SUM(total_amount), 0) as pending_payout 
            FROM bookings 
            WHERE turf_id IN (SELECT id FROM turfs WHERE owner_id = ?)
            AND status = 'confirmed' AND payment_status = 'fully_paid' AND payout_id IS NULL
        `, [ownerId]);

        const [[{ total_revenue }]] = await db.query(`
            SELECT COALESCE(SUM(final_amount), 0) as total_revenue
            FROM payouts WHERE owner_id = ? AND status = 'processed'
        `, [ownerId]);

        // 3. Transactions (Combine Payouts and Subscription Payments for a unified list) with pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        // Get total counts
        const [[{ payoutCount }]] = await db.query("SELECT COUNT(*) as count FROM payouts WHERE owner_id = ?", [ownerId]);
        const [[{ subCount }]] = await db.query("SELECT COUNT(*) as count FROM owner_subscriptions WHERE owner_id = ?", [ownerId]);
        const total = payoutCount + subCount;

        // Payouts received by owner
        const [payoutTx] = await db.query(`
            SELECT id, final_amount as amount, 'PAYOUT' as type, status, created_at 
            FROM payouts WHERE owner_id = ?
            ORDER BY created_at DESC LIMIT 100
        `, [ownerId]);

        // Subscriptions paid by owner
        const [subTx] = await db.query(`
            SELECT id, amount, 'SUBSCRIPTION' as type, status, created_at 
            FROM owner_subscriptions WHERE owner_id = ?
            ORDER BY created_at DESC LIMIT 100
        `, [ownerId]);

        const allTransactions = [...payoutTx, ...subTx].sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        const transactions = allTransactions.slice(offset, offset + limit);

        res.json({
            subscription,
            stats: {
                total_revenue,
                pending_payout,
                next_payout_date: 'Every Monday' // Descriptive placeholder
            },
            transactions: {
                data: transactions,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/owner/bookings - Bookings for owner's turfs with pagination
router.get('/bookings', authenticate, requireOwner, async (req, res) => {
    try {
        const ownerId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const [[{ total }]] = await db.query(`
            SELECT COUNT(*) as total FROM bookings b
            JOIN turfs t ON b.turf_id = t.id
            WHERE t.owner_id = ?
        `, [ownerId]);

        const [rows] = await db.query(`
            SELECT b.id, b.booking_date, b.start_time, b.end_time, b.total_amount as total_price, 
                   b.paid_amount, b.status, b.payment_status, t.name as turf_name, u.name as user_name,
                   CASE WHEN b.payout_id IS NOT NULL THEN 'settled' ELSE 'pending' END as settlement_status
            FROM bookings b
            JOIN turfs t ON b.turf_id = t.id
            JOIN users u ON b.user_id = u.id
            WHERE t.owner_id = ?
            ORDER BY b.created_at DESC
            LIMIT ? OFFSET ?
        `, [ownerId, limit, offset]);

        res.json({
            data: rows,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/owner/bookings/:id/settle - Mark booking as fully paid (paid at venue)
router.post('/bookings/:id/settle', authenticate, requireOwner, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const ownerId = req.user.id;

        // Verify ownership
        const [booking] = await db.query(`
            SELECT b.id, b.total_amount 
            FROM bookings b 
            JOIN turfs t ON b.turf_id = t.id 
            WHERE b.id = ? AND t.owner_id = ?
        `, [bookingId, ownerId]);

        if (booking.length === 0) return res.status(404).json({ message: 'Booking not found or not yours' });

        await db.query(`
            UPDATE bookings 
            SET paid_amount = total_amount, payment_status = 'fully_paid', status = 'confirmed' 
            WHERE id = ?
        `, [bookingId]);

        res.json({ message: 'Booking settled successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/owner/bookings/:id/cancel - Owner cancels booking
router.post('/bookings/:id/cancel', authenticate, requireOwner, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const ownerId = req.user.id;

        // Verify ownership
        const [booking] = await db.query(`
            SELECT b.id, b.slot_id 
            FROM bookings b 
            JOIN turfs t ON b.turf_id = t.id 
            WHERE b.id = ? AND t.owner_id = ?
        `, [bookingId, ownerId]);

        if (booking.length === 0) return res.status(404).json({ message: 'Booking not found or not yours' });

        await db.query("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [bookingId]);
        await db.query("UPDATE slots SET status = 'available' WHERE id = ?", [booking[0].slot_id]);

        res.json({ message: 'Booking cancelled successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
