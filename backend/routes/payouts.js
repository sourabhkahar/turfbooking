const express = require('express');
const db = require('../config/db');
const { authenticate, requireOwner, requireAdmin } = require('../middleware/auth');
const { processOwnerPayout, processAllPayouts, ELIGIBLE } = require('../services/payoutService');
const { getPlatformFeePercent } = require('../services/settings');

const router = express.Router();

// ══════════════════════════════════════════════════════════════════════════════
// OWNER ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/payouts/owner/stats - Earnings summary for owner
router.get('/owner/stats', authenticate, requireOwner, async (req, res) => {
    try {
        const [[{ pending_earnings }]] = await db.query(`
            SELECT COALESCE(SUM(b.online_amount), 0) AS pending_earnings
            FROM bookings b JOIN turfs t ON b.turf_id = t.id
            WHERE t.owner_id = ? AND ${ELIGIBLE}
        `, [req.user.id]);

        const [[{ total_payouts }]] = await db.query(`
            SELECT COALESCE(SUM(final_amount), 0) AS total_payouts
            FROM payouts WHERE owner_id = ? AND status = 'processed'
        `, [req.user.id]);

        const [transactions] = await db.query(`
            SELECT b.id, b.total_amount, b.online_amount, b.booking_date, b.payment_status, b.payout_id,
                   t.name AS turf_name,
                   p.status AS payout_status, p.processed_at, p.razorpay_payout_id
            FROM bookings b
            JOIN turfs t ON b.turf_id = t.id
            LEFT JOIN payouts p ON b.payout_id = p.id
            WHERE t.owner_id = ? AND b.status = 'confirmed'
            ORDER BY b.created_at DESC LIMIT 100
        `, [req.user.id]);

        const [[bankInfo]] = await db.query(
            'SELECT bank_account_number, ifsc_code, pan, upi_id FROM users WHERE id = ?', [req.user.id]
        );

        res.json({ pending_earnings, total_payouts, transactions, bankInfo, platform_fee_percent: await getPlatformFeePercent() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PATCH /api/payouts/owner/bank-details - Owner updates their bank details
router.patch('/owner/bank-details', authenticate, requireOwner, async (req, res) => {
    const bank_account_number = String(req.body.bank_account_number || '').replace(/\s/g, '');
    const ifsc_code = String(req.body.ifsc_code || '').toUpperCase().trim();
    const pan = String(req.body.pan || '').toUpperCase().trim();
    const upi_id = req.body.upi_id ? String(req.body.upi_id).trim() : null;

    if (!/^\d{9,18}$/.test(bank_account_number)) return res.status(400).json({ message: 'Bank account number must be 9–18 digits' });
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc_code)) return res.status(400).json({ message: 'Invalid IFSC code format' });
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return res.status(400).json({ message: 'Invalid PAN format' });
    if (upi_id && !/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/.test(upi_id)) return res.status(400).json({ message: 'Invalid UPI ID' });

    try {
        // Reset fund account so a new one is created on the next payout
        await db.query(
            `UPDATE users SET bank_account_number = ?, ifsc_code = ?, pan = ?, upi_id = ?, razorpay_fund_account_id = NULL
             WHERE id = ?`,
            [bank_account_number, ifsc_code, pan, upi_id, req.user.id]
        );
        res.json({ message: 'Bank details updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/payouts/admin/pending - Owners with earnings waiting for payout
router.get('/admin/pending', authenticate, requireAdmin, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
        const offset = (page - 1) * limit;
        const feeRate = (await getPlatformFeePercent()) / 100;

        const [[{ total }]] = await db.query(`
            SELECT COUNT(DISTINCT u.id) AS total
            FROM users u JOIN turfs t ON u.id = t.owner_id JOIN bookings b ON t.id = b.turf_id
            WHERE ${ELIGIBLE}
        `);

        const [pending] = await db.query(`
            SELECT u.id AS owner_id, u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone,
                   u.bank_account_number, u.ifsc_code, u.pan, u.upi_id,
                   u.razorpay_contact_id, u.razorpay_fund_account_id,
                   COUNT(b.id) AS booking_count,
                   SUM(b.online_amount) AS gross_amount,
                   ROUND(SUM(b.online_amount) * ?, 2) AS platform_fee,
                   ROUND(SUM(b.online_amount) * (1 - ?), 2) AS total_pending,
                   (SELECT MAX(p2.processed_at) FROM payouts p2 WHERE p2.owner_id = u.id AND p2.status = 'processed') AS last_payout_date
            FROM users u JOIN turfs t ON u.id = t.owner_id JOIN bookings b ON t.id = b.turf_id
            WHERE ${ELIGIBLE}
            GROUP BY u.id
            HAVING gross_amount > 0
            LIMIT ? OFFSET ?
        `, [feeRate, feeRate, limit, offset]);

        res.json({ data: pending, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/payouts/admin/history - All payouts
router.get('/admin/history', authenticate, requireAdmin, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const offset = (page - 1) * limit;

        const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM payouts');
        const [payouts] = await db.query(`
            SELECT p.*, u.name AS owner_name, u.email AS owner_email,
                   u.bank_account_number, u.ifsc_code, u.pan
            FROM payouts p JOIN users u ON p.owner_id = u.id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        res.json({ data: payouts, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/payouts/admin/process - Pay one owner via RazorpayX
router.post('/admin/process', authenticate, requireAdmin, async (req, res) => {
    const ownerId = parseInt(req.body.owner_id, 10);
    if (!Number.isInteger(ownerId)) return res.status(400).json({ message: 'owner_id is required' });
    try {
        const result = await processOwnerPayout(ownerId, req.body.mode, 'manual');
        res.json({
            message: result.status === 'processed' ? 'Payout processed successfully' : 'Payout initiated; awaiting bank confirmation',
            ...result,
        });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ message: err.message, detail: err.detail });
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/payouts/admin/process-all - Pay every eligible owner
router.post('/admin/process-all', authenticate, requireAdmin, async (req, res) => {
    try {
        const results = await processAllPayouts('manual');
        const ok = results.filter((r) => r.status !== 'failed').length;
        res.json({ message: `Initiated ${ok} of ${results.length} payouts`, results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/payouts/admin/owner/:id/details
router.get('/admin/owner/:id/details', authenticate, requireAdmin, async (req, res) => {
    try {
        const [[owner]] = await db.query(
            'SELECT id, name, email, phone, bank_account_number, ifsc_code, pan, upi_id FROM users WHERE id = ?',
            [req.params.id]
        );
        if (!owner) return res.status(404).json({ message: 'Owner not found' });

        const [payoutHistory] = await db.query(
            'SELECT * FROM payouts WHERE owner_id = ? ORDER BY created_at DESC LIMIT 20', [req.params.id]
        );
        const [[{ pending }]] = await db.query(`
            SELECT COALESCE(SUM(b.online_amount), 0) AS pending
            FROM bookings b JOIN turfs t ON b.turf_id = t.id
            WHERE t.owner_id = ? AND ${ELIGIBLE}
        `, [req.params.id]);

        res.json({ owner, payoutHistory, pendingAmount: pending });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
