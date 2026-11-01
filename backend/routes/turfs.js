const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authenticate, requireOwner, requireAdmin, requireSubscription } = require('../middleware/auth');
const { ACTIVE_OWNER_SQL } = require('../services/subscriptionService');

const router = express.Router();

// GET /api/turfs — public, approved only
router.get('/', async (req, res) => {
    try {
        const { city, sport_type, search, page = 1, limit = 12 } = req.query;
        const p = parseInt(page);
        const l = parseInt(limit);
        const offset = (p - 1) * l;

        let baseQuery = `FROM turfs t JOIN users u ON t.owner_id = u.id WHERE t.status = 'approved' AND u.status = 'active' AND ${ACTIVE_OWNER_SQL}`;
        const params = [];

        if (city) { baseQuery += ' AND t.city LIKE ?'; params.push(`%${city}%`); }
        if (sport_type) { baseQuery += ' AND t.sport_type = ?'; params.push(sport_type); }
        if (search) { baseQuery += ' AND (t.name LIKE ? OR t.location LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

        const [[{ total }]] = await db.query(`SELECT COUNT(*) as total ${baseQuery}`, params);

        let dataQuery = `SELECT t.*, u.name as owner_name, u.phone as owner_phone,
            (SELECT price_per_hour FROM pricing_rules WHERE turf_id = t.id AND rule_type = 'base' ORDER BY id LIMIT 1) as base_price
            ${baseQuery} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
        
        const [turfs] = await db.query(dataQuery, [...params, l, offset]);

        const processedTurfs = turfs.map(t => ({
            ...t,
            facilities: typeof t.facilities === 'string' ? JSON.parse(t.facilities || '[]') : t.facilities,
            images: typeof t.images === 'string' ? JSON.parse(t.images || '[]') : t.images
        }));

        res.json({
            data: processedTurfs,
            total,
            page: p,
            limit: l,
            totalPages: Math.ceil(total / l)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/turfs/:id — single turf
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT t.*, u.name as owner_name, u.phone as owner_phone, u.email as owner_email
       FROM turfs t JOIN users u ON t.owner_id = u.id WHERE t.id = ?`,
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Turf not found' });
        const turf = rows[0];
        turf.facilities = typeof turf.facilities === 'string' ? JSON.parse(turf.facilities || '[]') : turf.facilities;
        turf.images = typeof turf.images === 'string' ? JSON.parse(turf.images || '[]') : turf.images;
        res.json(turf);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/turfs/owner/my — owner's turfs with pagination
router.get('/owner/my', authenticate, requireOwner, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const offset = (page - 1) * limit;

        const [[{ total }]] = await db.query("SELECT COUNT(*) as total FROM turfs WHERE owner_id = ? AND status != 'deleted'", [req.user.id]);

        const [turfs] = await db.query(
            `SELECT t.*,
        (SELECT COUNT(*) FROM slots s WHERE s.turf_id = t.id AND s.status = 'booked') as total_bookings,
        (SELECT price_per_hour FROM pricing_rules WHERE turf_id = t.id AND rule_type = 'base' LIMIT 1) as base_price
        FROM turfs t WHERE t.owner_id = ? AND t.status != 'deleted' ORDER BY t.created_at DESC
        LIMIT ? OFFSET ?`,
        [req.user.id, limit, offset]
        );
        
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

// POST /api/turfs — owner creates turf
router.post('/', authenticate, requireOwner, requireSubscription, [
    body('name').trim().notEmpty().withMessage('Turf name required'),
    body('location').trim().notEmpty().withMessage('Location required'),
    body('city').trim().notEmpty().withMessage('City required'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, description, location, city, sport_type, facilities, images, part_payment_percentage } = req.body;
    const pct = Number(part_payment_percentage) || 0;
    if (pct < 0 || pct > 100) return res.status(400).json({ message: 'Part payment percentage must be 0–100' });
    try {
        if (req.user.role !== 'super_admin') {
            const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM turfs WHERE owner_id = ? AND status <> 'deleted'", [req.user.id]);
            const max = req.subscription?.max_turfs;
            if (max != null && n >= max) {
                return res.status(403).json({ code: 'PLAN_UPGRADE_REQUIRED', message: `Your plan allows ${max} turf${max === 1 ? '' : 's'}. Upgrade to add more.` });
            }
        }
        const [result] = await db.query(
            'INSERT INTO turfs (owner_id, name, description, location, city, sport_type, facilities, images, part_payment_percentage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [req.user.id, name, description || null, location, city, sport_type || 'Football',
            JSON.stringify(facilities || []), JSON.stringify(images || []), pct]
        );

        res.status(201).json({ message: 'Turf submitted for approval', turf_id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/turfs/:id — owner updates turf
router.put('/:id', authenticate, requireOwner, requireSubscription, async (req, res) => {
    try {
        const [turf] = await db.query('SELECT * FROM turfs WHERE id = ?', [req.params.id]);
        if (turf.length === 0) return res.status(404).json({ message: 'Turf not found' });
        if (turf[0].owner_id !== req.user.id && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: 'Not your turf' });
        }
        const { name, description, location, city, sport_type, facilities, images, part_payment_percentage } = req.body;
        await db.query(
            'UPDATE turfs SET name=?, description=?, location=?, city=?, sport_type=?, facilities=?, images=?, part_payment_percentage=? WHERE id=?',
            [name, description, location, city, sport_type, JSON.stringify(facilities || []), JSON.stringify(images || []), part_payment_percentage || 0, req.params.id]
        );

        res.json({ message: 'Turf updated successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/turfs/:id
router.delete('/:id', authenticate, requireOwner, async (req, res) => {
    try {
        const [turf] = await db.query('SELECT * FROM turfs WHERE id = ?', [req.params.id]);
        if (turf.length === 0) return res.status(404).json({ message: 'Turf not found' });
        if (turf[0].owner_id !== req.user.id && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: 'Not your turf' });
        }
        await db.query("UPDATE turfs SET status = 'deleted' WHERE id = ?", [req.params.id]);
        res.json({ message: 'Turf deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PATCH /api/turfs/:id/status — admin approve/reject
router.patch('/:id/status', authenticate, requireAdmin, async (req, res) => {
    const { status, rejection_reason } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
    try {
        await db.query('UPDATE turfs SET status = ?, rejection_reason = ? WHERE id = ?',
            [status, rejection_reason || null, req.params.id]);
        res.json({ message: `Turf ${status}` });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PATCH /api/turfs/:id/base-price — owner updates base price
router.put('/:id/base-price', authenticate, requireOwner, requireSubscription, async (req, res) => {
    const { base_price } = req.body;
    try {
        const [turf] = await db.query('SELECT id FROM turfs WHERE id = ? AND owner_id = ?', [req.params.id, req.user.id]);
        if (turf.length === 0) return res.status(404).json({ message: 'Turf not found' });

        // Update or insert base price in pricing_rules
        await db.query("DELETE FROM pricing_rules WHERE turf_id = ? AND rule_type = 'base'", [req.params.id]);
        await db.query(
            "INSERT INTO pricing_rules (turf_id, rule_type, price_per_hour, label) VALUES (?, 'base', ?, 'Base Price')",
            [req.params.id, base_price]
        );

        res.json({ message: 'Base price updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
