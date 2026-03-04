const express = require('express');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const db = require('../config/db');
const { authenticate, requireOwner, requireUser } = require('../middleware/auth');

const router = express.Router();

// POST /api/booking-links - Create a temporary booking link
router.post('/', authenticate, requireOwner, [
    body('turf_id').isInt(),
    body('slot_id').optional({ nullable: true }).isInt(),
    body('date').isDate(),
    body('start_time').matches(/^\d{2}:\d{2}(:\d{2})?$/),
    body('end_time').matches(/^\d{2}:\d{2}(:\d{2})?$/),
    body('price').isFloat({ min: 0 }),
    body('expires_in_minutes').isInt({ min: 1, max: 1440 }) // up to 24 hours
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { turf_id, slot_id, date, start_time, end_time, price, expires_in_minutes } = req.body;

    try {
        // Verify turf ownership
        const [turf] = await db.query('SELECT id FROM turfs WHERE id = ? AND owner_id = ?', [turf_id, req.user.id]);
        if (turf.length === 0 && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: 'Not your turf' });
        }

        const token = crypto.randomBytes(16).toString('hex');

        // Calculate expiration date
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + expires_in_minutes);

        await db.query(`
            INSERT INTO booking_tokens 
            (token, turf_id, slot_id, date, start_time, end_time, price, created_by, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            token, turf_id, slot_id || null, date, start_time, end_time, price, req.user.id, expiresAt
        ]);

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const link = `${frontendUrl}/book-link/${token}`;

        res.status(201).json({
            message: 'Booking link created',
            token,
            link,
            expires_at: expiresAt
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/booking-links/:token - Get booking link details
router.get('/:token', async (req, res) => {
    try {
        const [tokens] = await db.query(`
            SELECT bt.*, t.name as turf_name, t.location, t.city 
            FROM booking_tokens bt
            JOIN turfs t ON bt.turf_id = t.id
            WHERE bt.token = ?
        `, [req.params.token]);

        if (tokens.length === 0) return res.status(404).json({ message: 'Invalid token' });

        const linkData = tokens[0];

        if (linkData.status !== 'active') {
            return res.status(400).json({ message: `Link is ${linkData.status}` });
        }

        if (new Date(linkData.expires_at) < new Date()) {
            await db.query("UPDATE booking_tokens SET status = 'expired' WHERE token = ?", [req.params.token]);
            return res.status(400).json({ message: 'Link has expired' });
        }

        res.json(linkData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/booking-links/:token/book - Book using the temporary link
router.post('/:token/book', authenticate, requireUser, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Fetch token
        const [tokens] = await conn.query('SELECT * FROM booking_tokens WHERE token = ? FOR UPDATE', [req.params.token]);
        if (tokens.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Invalid token' });
        }

        const linkData = tokens[0];

        if (linkData.status !== 'active') {
            await conn.rollback();
            return res.status(400).json({ message: `Link is ${linkData.status}` });
        }

        if (new Date(linkData.expires_at) < new Date()) {
            await conn.query("UPDATE booking_tokens SET status = 'expired' WHERE token = ?", [req.params.token]);
            await conn.commit();
            return res.status(400).json({ message: 'Link has expired' });
        }

        // 2. Resolve Slot
        let finalSlotId = linkData.slot_id;

        if (finalSlotId) {
            // Check if slot is available
            const [slots] = await conn.query('SELECT status FROM slots WHERE id = ? FOR UPDATE', [finalSlotId]);
            if (slots.length === 0 || slots[0].status !== 'available') {
                await conn.rollback();
                return res.status(409).json({ message: 'Slot is no longer available' });
            }
            // we will mark it as booked later
        } else {
            // Block all overlapping slots
            const [overlappingSlots] = await conn.query(
                `SELECT id, status FROM slots 
                 WHERE turf_id = ? AND date = ? 
                 AND start_time < ? AND end_time > ? 
                 FOR UPDATE`,
                [linkData.turf_id, linkData.date, linkData.end_time, linkData.start_time]
            );

            const unavailable = overlappingSlots.filter(s => s.status !== 'available');
            if (unavailable.length > 0) {
                await conn.rollback();
                return res.status(409).json({ message: 'One or more slots in this time range are no longer available.' });
            }

            if (overlappingSlots.length > 0) {
                const slotIds = overlappingSlots.map(s => s.id);
                await conn.query("DELETE FROM slots WHERE id IN (?)", [slotIds]);
            }
            // Create a new single slot to represent this huge booking
            const [result] = await conn.query(
                'INSERT INTO slots (turf_id, date, start_time, end_time, status) VALUES (?, ?, ?, ?, ?)',
                [linkData.turf_id, linkData.date, linkData.start_time, linkData.end_time, 'booked']
            );
            finalSlotId = result.insertId;
        }

        // 3. Create Booking
        const [startH, startM] = linkData.start_time.split(':').map(Number);
        const [endH, endM] = linkData.end_time.split(':').map(Number);
        const durationHours = ((endH * 60 + endM) - (startH * 60 + startM)) / 60;
        const totalAmount = parseFloat(linkData.price);
        const pricePerHour = durationHours > 0 ? totalAmount / durationHours : totalAmount;

        const [bookResult] = await conn.query(
            `INSERT INTO bookings (slot_id, user_id, turf_id, booking_date, start_time, end_time, 
            duration_hours, price_per_hour, total_amount, paid_amount, remaining_amount, payment_status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [finalSlotId, req.user.id, linkData.turf_id, linkData.date, linkData.start_time, linkData.end_time,
                durationHours, pricePerHour, totalAmount, 0, totalAmount, 'unpaid', 'Booked via temporary link']
        );


        // 4. Mark token as used
        if (linkData.slot_id) {
            await conn.query("UPDATE slots SET status = 'booked' WHERE id = ?", [finalSlotId]);
        }
        await conn.query("UPDATE booking_tokens SET status = 'used', slot_id = ? WHERE token = ?", [finalSlotId, req.params.token]);

        await conn.commit();

        res.status(201).json({
            message: 'Booking initialized!',
            booking_id: bookResult.insertId,
            total_amount: totalAmount,
            amount_to_pay: totalAmount // Booking links are usually full payment or as specified
        });


    } catch (err) {
        await conn.rollback();
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Slot already exists for this time and might be taken.' });
        }
        res.status(500).json({ message: 'Server error' });
    } finally {
        conn.release();
    }
});

module.exports = router;
