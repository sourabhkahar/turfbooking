const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authenticate, requireOwner, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/turfs — public, approved only
router.get('/', async (req, res) => {
    try {
        const { city, sport_type, search } = req.query;
        let query = `SELECT t.*, u.name as owner_name, u.phone as owner_phone,
      (SELECT price_per_hour FROM pricing_rules WHERE turf_id = t.id AND rule_type = 'base' ORDER BY id LIMIT 1) as base_price
      FROM turfs t JOIN users u ON t.owner_id = u.id WHERE t.status = 'approved'`;
        const params = [];

        if (city) { query += ' AND t.city LIKE ?'; params.push(`%${city}%`); }
        if (sport_type) { query += ' AND t.sport_type = ?'; params.push(sport_type); }
        if (search) { query += ' AND (t.name LIKE ? OR t.location LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

        query += ' ORDER BY t.created_at DESC';
        const [turfs] = await db.query(query, params);
        res.json(turfs);
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
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/turfs/owner/my — owner's turfs
router.get('/owner/my', authenticate, requireOwner, async (req, res) => {
    try {
        const [turfs] = await db.query(
            `SELECT t.*,
        (SELECT COUNT(*) FROM slots s WHERE s.turf_id = t.id AND s.status = 'booked') as total_bookings,
        (SELECT price_per_hour FROM pricing_rules WHERE turf_id = t.id AND rule_type = 'base' LIMIT 1) as base_price
        FROM turfs t WHERE t.owner_id = ? ORDER BY t.created_at DESC`,
            [req.user.id]
        );
        res.json(turfs);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/turfs — owner creates turf
router.post('/', authenticate, requireOwner, [
    body('name').trim().notEmpty().withMessage('Turf name required'),
    body('location').trim().notEmpty().withMessage('Location required'),
    body('city').trim().notEmpty().withMessage('City required'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, description, location, city, sport_type, facilities, images } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO turfs (owner_id, name, description, location, city, sport_type, facilities, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [req.user.id, name, description || null, location, city, sport_type || 'Football',
            JSON.stringify(facilities || []), JSON.stringify(images || [])]
        );
        res.status(201).json({ message: 'Turf submitted for approval', turf_id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/turfs/:id — owner updates turf
router.put('/:id', authenticate, requireOwner, async (req, res) => {
    try {
        const [turf] = await db.query('SELECT * FROM turfs WHERE id = ?', [req.params.id]);
        if (turf.length === 0) return res.status(404).json({ message: 'Turf not found' });
        if (turf[0].owner_id !== req.user.id && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: 'Not your turf' });
        }
        const { name, description, location, city, sport_type, facilities, images } = req.body;
        await db.query(
            'UPDATE turfs SET name=?, description=?, location=?, city=?, sport_type=?, facilities=?, images=? WHERE id=?',
            [name, description, location, city, sport_type, JSON.stringify(facilities || []), JSON.stringify(images || []), req.params.id]
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
        await db.query('DELETE FROM turfs WHERE id = ?', [req.params.id]);
        res.json({ message: 'Turf deleted' });
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

module.exports = router;
