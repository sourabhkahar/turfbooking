const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authenticate, requireOwner } = require('../middleware/auth');

const router = express.Router();

// GET /api/slots?turf_id=&date= — public, list available slots
router.get('/', async (req, res) => {
    const { turf_id, date } = req.query;
    if (!turf_id || !date) return res.status(400).json({ message: 'turf_id and date are required' });
    try {
        const [slots] = await db.query(
            `SELECT s.*, 
                (SELECT price_per_hour FROM pricing_rules WHERE turf_id = s.turf_id AND rule_type = 'base' LIMIT 1) as base_price,
                (SELECT multiplier FROM pricing_rules 
                 WHERE turf_id = s.turf_id AND rule_type = 'custom'
                 AND (day_of_week IS NULL OR day_of_week = DAYOFWEEK(s.date) - 1)
                 AND (start_time IS NULL OR start_time <= s.start_time)
                 AND (end_time IS NULL OR (end_time > s.start_time AND end_time >= s.end_time))
                 ORDER BY id DESC LIMIT 1) as multiplier
             FROM slots s WHERE s.turf_id = ? AND s.date = ? ORDER BY s.start_time`,
            [turf_id, date]
        );

        const processed = slots.map(s => ({
            ...s,
            price_per_hour: (s.base_price || 0) * (s.multiplier || 1)
        }));

        res.json(processed);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/slots/owner?turf_id=&date= — owner view (all statuses)
router.get('/owner', authenticate, requireOwner, async (req, res) => {
    const { turf_id, date } = req.query;
    if (!turf_id || !date) return res.status(400).json({ message: 'turf_id and date required' });
    try {
        // Verify turf belongs to owner
        const [turf] = await db.query('SELECT id FROM turfs WHERE id = ? AND owner_id = ?', [turf_id, req.user.id]);
        if (turf.length === 0 && req.user.role !== 'super_admin') return res.status(403).json({ message: 'Not your turf' });

        const [slots] = await db.query(
            'SELECT * FROM slots WHERE turf_id = ? AND date = ? ORDER BY start_time',
            [turf_id, date]
        );
        res.json(slots);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/slots — owner creates single slot
router.post('/', authenticate, requireOwner, [
    body('turf_id').isInt(),
    body('date').isDate(),
    body('start_time').matches(/^\d{2}:\d{2}$/),
    body('end_time').matches(/^\d{2}:\d{2}$/),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { turf_id, date, start_time, end_time } = req.body;
    try {
        const [turf] = await db.query('SELECT id FROM turfs WHERE id = ? AND owner_id = ?', [turf_id, req.user.id]);
        if (turf.length === 0) return res.status(403).json({ message: 'Not your turf' });

        await db.query('INSERT INTO slots (turf_id, date, start_time, end_time) VALUES (?, ?, ?, ?)',
            [turf_id, date, start_time, end_time]);
        res.status(201).json({ message: 'Slot created' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Slot already exists for this time' });
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/slots/bulk — owner generates slots in bulk for a date
router.post('/bulk', authenticate, requireOwner, [
    body('turf_id').isInt(),
    body('date').isDate(),
    body('start_hour').isInt({ min: 0, max: 23 }),
    body('end_hour').isInt({ min: 1, max: 24 }),
    body('slot_duration').isInt({ min: 30, max: 240 }).withMessage('Duration in minutes'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { turf_id, date, start_hour, end_hour, slot_duration } = req.body;
    try {
        const [turf] = await db.query('SELECT id FROM turfs WHERE id = ? AND owner_id = ?', [turf_id, req.user.id]);
        if (turf.length === 0) return res.status(403).json({ message: 'Not your turf' });

        const slots = [];
        let current = start_hour * 60; // minutes from midnight
        const endMinutes = end_hour * 60;

        while (current + slot_duration <= endMinutes) {
            const startH = String(Math.floor(current / 60)).padStart(2, '0');
            const startM = String(current % 60).padStart(2, '0');
            const endH = String(Math.floor((current + slot_duration) / 60)).padStart(2, '0');
            const endM = String((current + slot_duration) % 60).padStart(2, '0');
            slots.push([turf_id, date, `${startH}:${startM}`, `${endH}:${endM}`]);
            current += slot_duration;
        }

        if (slots.length === 0) return res.status(400).json({ message: 'No slots to generate' });

        let created = 0;
        for (const slot of slots) {
            try {
                await db.query('INSERT IGNORE INTO slots (turf_id, date, start_time, end_time) VALUES (?, ?, ?, ?)', slot);
                created++;
            } catch (_) { }
        }

        res.status(201).json({ message: `${created} slots created for ${date}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PATCH /api/slots/:id/block — owner blocks a slot
router.patch('/:id/block', authenticate, requireOwner, async (req, res) => {
    const { reason } = req.body;
    try {
        const [slot] = await db.query(
            'SELECT s.*, t.owner_id FROM slots s JOIN turfs t ON s.turf_id = t.id WHERE s.id = ?',
            [req.params.id]
        );
        if (slot.length === 0) return res.status(404).json({ message: 'Slot not found' });
        if (slot[0].owner_id !== req.user.id && req.user.role !== 'super_admin') return res.status(403).json({ message: 'Forbidden' });
        if (slot[0].status === 'booked') return res.status(409).json({ message: 'Slot is already booked' });

        await db.query('UPDATE slots SET status = ?, block_reason = ? WHERE id = ?',
            ['blocked', reason || null, req.params.id]);
        res.json({ message: 'Slot blocked successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PATCH /api/slots/:id/unblock — owner unblocks
router.patch('/:id/unblock', authenticate, requireOwner, async (req, res) => {
    try {
        const [slot] = await db.query(
            'SELECT s.*, t.owner_id FROM slots s JOIN turfs t ON s.turf_id = t.id WHERE s.id = ?',
            [req.params.id]
        );
        if (slot.length === 0) return res.status(404).json({ message: 'Slot not found' });
        if (slot[0].owner_id !== req.user.id && req.user.role !== 'super_admin') return res.status(403).json({ message: 'Forbidden' });

        await db.query("UPDATE slots SET status = 'available', block_reason = NULL WHERE id = ?", [req.params.id]);
        res.json({ message: 'Slot unblocked' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/slots/:turf_id — owner/admin view for slot manager
router.get('/:turf_id', authenticate, requireOwner, async (req, res) => {
    const { turf_id } = req.params;
    const { date } = req.query;
    if (!turf_id || !date) return res.status(400).json({ message: 'turf_id and date required' });
    try {
        const [slots] = await db.query(
            `SELECT id as slot_id, start_time, end_time, 
             CASE WHEN status IN ('blocked', 'booked') THEN 1 ELSE 0 END as is_blocked,
             status
             FROM slots WHERE turf_id = ? AND date = ? ORDER BY start_time`,
            [turf_id, date]
        );
        res.json(slots);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/slots/block — block a slot
router.post('/block', authenticate, requireOwner, async (req, res) => {
    const { slot_id } = req.body;
    try {
        const [slot] = await db.query(
            "SELECT s.id FROM slots s JOIN turfs t ON s.turf_id = t.id WHERE s.id = ? AND t.owner_id = ?",
            [slot_id, req.user.id]
        );
        if (slot.length === 0) return res.status(403).json({ message: 'Not your slot' });

        await db.query("UPDATE slots SET status = 'blocked' WHERE id = ?", [slot_id]);
        res.json({ message: 'Slot blocked' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/slots/unblock/:id — unblock a slot
router.post('/unblock/:id', authenticate, requireOwner, async (req, res) => {
    try {
        const [slot] = await db.query(
            "SELECT s.id, s.status FROM slots s JOIN turfs t ON s.turf_id = t.id WHERE s.id = ? AND t.owner_id = ?",
            [req.params.id, req.user.id]
        );
        if (slot.length === 0) return res.status(403).json({ message: 'Not your slot' });
        if (slot[0].status === 'booked') return res.status(403).json({ message: 'Cannot unblock a booked slot' });

        await db.query("UPDATE slots SET status = 'available' WHERE id = ?", [req.params.id]);
        res.json({ message: 'Slot unblocked' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/slots/generate/:turf_id — generate slots for next custom date range
router.post('/generate/:turf_id', authenticate, requireOwner, async (req, res) => {
    const { turf_id } = req.params;
    const { start_date, end_date } = req.body;
    try {
        const [turf] = await db.query('SELECT id FROM turfs WHERE id = ? AND owner_id = ?', [turf_id, req.user.id]);
        if (turf.length === 0) return res.status(403).json({ message: 'Not your turf' });

        const slots = [];
        let startObj = new Date();
        if (start_date) {
            startObj = new Date(`${start_date}T00:00:00`);
        } else {
            startObj.setHours(0, 0, 0, 0);
        }

        let endObj = new Date(startObj);
        if (end_date) {
            endObj = new Date(`${end_date}T00:00:00`);
        } else {
            endObj.setDate(startObj.getDate() + 6); // default 7-day range
        }

        const diffTime = endObj.getTime() - startObj.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return res.status(400).json({ message: 'End date must be after start date' });
        if (diffDays > 366) return res.status(400).json({ message: 'Cannot generate slots for more than 1 year' });

        for (let i = 0; i <= diffDays; i++) {
            const date = new Date(startObj);
            date.setDate(startObj.getDate() + i);
            // Format safely to local YYYY-MM-DD to avoid GMT offsets
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            for (let hour = 6; hour < 23; hour++) {
                const start = `${String(hour).padStart(2, '0')}:00`;
                const end = `${String(hour + 1).padStart(2, '0')}:00`;
                slots.push([turf_id, dateStr, start, end, 'available']);
            }
        }

        for (const s of slots) {
            await db.query(
                "INSERT IGNORE INTO slots (turf_id, date, start_time, end_time, status) VALUES (?, ?, ?, ?, ?)",
                s
            );
        }

        res.json({ message: `Slots generated successfully` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
