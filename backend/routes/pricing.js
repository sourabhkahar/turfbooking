const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authenticate, requireOwner } = require('../middleware/auth');

const router = express.Router();

// GET /api/pricing/:turf_id — get all pricing rules for a turf
router.get('/:turf_id', async (req, res) => {
    try {
        const [rules] = await db.query(
            'SELECT * FROM pricing_rules WHERE turf_id = ? ORDER BY rule_type, id',
            [req.params.turf_id]
        );
        res.json(rules);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/pricing — owner sets a pricing rule (base or custom)
router.post('/', authenticate, requireOwner, [
    body('turf_id').isInt(),
    body('rule_type').isIn(['base', 'custom']).withMessage('rule_type must be base or custom'),
    body('price_per_hour').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { turf_id, rule_type, day_of_week, start_time, end_time, price_per_hour, label } = req.body;
    try {
        // Verify turf ownership
        const [turf] = await db.query('SELECT id FROM turfs WHERE id = ? AND owner_id = ?', [turf_id, req.user.id]);
        if (turf.length === 0 && req.user.role !== 'super_admin') return res.status(403).json({ message: 'Not your turf' });

        // If base rule, delete old base rule and insert new one
        if (rule_type === 'base') {
            await db.query("DELETE FROM pricing_rules WHERE turf_id = ? AND rule_type = 'base'", [turf_id]);
        }

        const [result] = await db.query(
            'INSERT INTO pricing_rules (turf_id, rule_type, day_of_week, start_time, end_time, price_per_hour, label) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [turf_id, rule_type, day_of_week ?? null, start_time || null, end_time || null, price_per_hour, label || null]
        );
        res.status(201).json({ message: 'Pricing rule created', id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/pricing/:id — update a pricing rule
router.put('/:id', authenticate, requireOwner, async (req, res) => {
    try {
        const [rule] = await db.query(
            'SELECT pr.*, t.owner_id FROM pricing_rules pr JOIN turfs t ON pr.turf_id = t.id WHERE pr.id = ?',
            [req.params.id]
        );
        if (rule.length === 0) return res.status(404).json({ message: 'Rule not found' });
        if (rule[0].owner_id !== req.user.id && req.user.role !== 'super_admin') return res.status(403).json({ message: 'Forbidden' });

        const { day_of_week, start_time, end_time, price_per_hour, label } = req.body;
        await db.query(
            'UPDATE pricing_rules SET day_of_week=?, start_time=?, end_time=?, price_per_hour=?, label=? WHERE id=?',
            [day_of_week ?? null, start_time || null, end_time || null, price_per_hour, label || null, req.params.id]
        );
        res.json({ message: 'Pricing rule updated' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/pricing/:id — delete a pricing rule
router.delete('/:id', authenticate, requireOwner, async (req, res) => {
    try {
        const [rule] = await db.query(
            'SELECT pr.*, t.owner_id FROM pricing_rules pr JOIN turfs t ON pr.turf_id = t.id WHERE pr.id = ?',
            [req.params.id]
        );
        if (rule.length === 0) return res.status(404).json({ message: 'Rule not found' });
        if (rule[0].owner_id !== req.user.id && req.user.role !== 'super_admin') return res.status(403).json({ message: 'Forbidden' });

        await db.query('DELETE FROM pricing_rules WHERE id = ?', [req.params.id]);
        res.json({ message: 'Pricing rule deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
