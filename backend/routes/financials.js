const express = require('express');
const db = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/financials - Aggregated financial view for Admin
router.get('/', authenticate, requireAdmin, async (req, res) => {
    try {
        const [subscriptions] = await db.query(`
            SELECT s.*, u.name as owner_name FROM owner_subscriptions s
            JOIN users u ON s.owner_id = u.id ORDER BY s.created_at DESC LIMIT 50
        `);
        const [payouts] = await db.query(`
            SELECT p.*, u.name as owner_name FROM payouts p
            JOIN users u ON p.owner_id = u.id ORDER BY p.processed_at DESC LIMIT 50
        `);
        const [bookings] = await db.query(`
            SELECT b.id, b.total_amount as total_price, b.paid_amount, b.status, b.created_at,
                   (b.total_amount * 0.1) as platform_fee, t.name as turf_name
            FROM bookings b JOIN turfs t ON b.turf_id = t.id
            WHERE b.status = 'confirmed' ORDER BY b.created_at DESC LIMIT 50
        `);
        res.json({ subscriptions, payouts, bookings });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/financials/subscriptions - All subscription payments with pagination
router.get('/subscriptions', authenticate, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM owner_subscriptions');
        const [rows] = await db.query(`
            SELECT s.*, u.name as owner_name, u.email as owner_email
            FROM owner_subscriptions s
            JOIN users u ON s.owner_id = u.id
            ORDER BY s.created_at DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);
        
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

// GET /api/financials/payouts - All payout history with pagination
router.get('/payouts', authenticate, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM payouts');
        const [rows] = await db.query(`
            SELECT p.*, u.name as owner_name, u.email as owner_email
            FROM payouts p
            JOIN users u ON p.owner_id = u.id
            ORDER BY p.processed_at DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);

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

// GET /api/financials/bookings - All user booking payments with pagination
router.get('/bookings', authenticate, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const [[{ total }]] = await db.query("SELECT COUNT(*) as total FROM bookings WHERE status = 'confirmed'");
        const [rows] = await db.query(`
            SELECT b.id, b.total_amount as total_price, b.paid_amount, b.status, b.payment_status, b.payment_method, b.created_at,
                   t.name as turf_name, u.name as customer_name, o.name as owner_name,
                   (b.total_amount * 0.1) as platform_fee
            FROM bookings b
            JOIN turfs t ON b.turf_id = t.id
            JOIN users u ON b.user_id = u.id
            JOIN users o ON t.owner_id = o.id
            WHERE b.status = 'confirmed'
            ORDER BY b.created_at DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);

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

module.exports = router;
