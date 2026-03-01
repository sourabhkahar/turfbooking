const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authenticate, requireOwner, requireAdmin, requireUser } = require('../middleware/auth');

const router = express.Router();

// POST /api/bookings — customer books a slot
router.post('/', authenticate, requireUser, [
    body('slot_id').isInt(),
    body('notes').optional().isString(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { slot_id, notes } = req.body;
    const conn = await (require('../config/db')).getConnection();
    try {
        await conn.beginTransaction();

        // Lock the slot row
        const [slots] = await conn.query('SELECT * FROM slots WHERE id = ? FOR UPDATE', [slot_id]);
        if (slots.length === 0) { await conn.rollback(); return res.status(404).json({ message: 'Slot not found' }); }
        const slot = slots[0];

        if (slot.status !== 'available') {
            await conn.rollback();
            return res.status(409).json({ message: `Slot is ${slot.status}. Cannot book.` });
        }

        // Get turf info
        const [turfs] = await conn.query('SELECT * FROM turfs WHERE id = ?', [slot.turf_id]);
        const turf = turfs[0];

        // Calculate price
        const [customPrice] = await conn.query(
            `SELECT price_per_hour FROM pricing_rules WHERE turf_id = ? AND rule_type = 'custom'
       AND start_time <= ? AND end_time >= ? ORDER BY id DESC LIMIT 1`,
            [slot.turf_id, slot.start_time, slot.end_time]
        );
        const [basePrice] = await conn.query(
            "SELECT price_per_hour FROM pricing_rules WHERE turf_id = ? AND rule_type = 'base' LIMIT 1",
            [slot.turf_id]
        );

        const pricePerHour = customPrice[0]?.price_per_hour || basePrice[0]?.price_per_hour || 0;

        // Calculate duration in hours
        const [startH, startM] = slot.start_time.split(':').map(Number);
        const [endH, endM] = slot.end_time.split(':').map(Number);
        const durationHours = ((endH * 60 + endM) - (startH * 60 + startM)) / 60;
        const totalAmount = pricePerHour * durationHours;

        // Create booking
        const [result] = await conn.query(
            `INSERT INTO bookings (slot_id, user_id, turf_id, booking_date, start_time, end_time, 
        duration_hours, price_per_hour, total_amount, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [slot_id, req.user.id, slot.turf_id, slot.date, slot.start_time, slot.end_time,
                durationHours, pricePerHour, totalAmount, notes || null]
        );

        // Mark slot as booked
        await conn.query("UPDATE slots SET status = 'booked' WHERE id = ?", [slot_id]);
        await conn.commit();

        res.status(201).json({
            message: 'Booking confirmed!',
            booking_id: result.insertId,
            total_amount: totalAmount,
            turf_name: turf.name,
            date: slot.date,
            time: `${slot.start_time} - ${slot.end_time}`
        });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    } finally {
        conn.release();
    }
});

// GET /api/bookings/my — customer's own bookings
router.get('/my', authenticate, requireUser, async (req, res) => {
    try {
        const [bookings] = await db.query(
            `SELECT b.*, t.name as turf_name, t.location, t.city
       FROM bookings b JOIN turfs t ON b.turf_id = t.id
       WHERE b.user_id = ? ORDER BY b.booking_date DESC, b.start_time DESC`,
            [req.user.id]
        );
        res.json(bookings);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/bookings/turf/:turf_id — owner sees all bookings for their turf
router.get('/turf/:turf_id', authenticate, requireOwner, async (req, res) => {
    try {
        const [turf] = await db.query('SELECT id FROM turfs WHERE id = ? AND owner_id = ?', [req.params.turf_id, req.user.id]);
        if (turf.length === 0 && req.user.role !== 'super_admin') return res.status(403).json({ message: 'Not your turf' });

        const { date, status } = req.query;
        let query = `SELECT b.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone
                 FROM bookings b JOIN users u ON b.user_id = u.id
                 WHERE b.turf_id = ?`;
        const params = [req.params.turf_id];

        if (date) { query += ' AND b.booking_date = ?'; params.push(date); }
        if (status) { query += ' AND b.status = ?'; params.push(status); }
        query += ' ORDER BY b.booking_date DESC, b.start_time';

        const [bookings] = await db.query(query, params);
        res.json(bookings);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/bookings/all — super admin sees all bookings
router.get('/all', authenticate, requireAdmin, async (req, res) => {
    try {
        const [bookings] = await db.query(
            `SELECT b.*, u.name as customer_name, t.name as turf_name, t.city
       FROM bookings b 
       JOIN users u ON b.user_id = u.id 
       JOIN turfs t ON b.turf_id = t.id
       ORDER BY b.created_at DESC LIMIT 500`
        );
        res.json(bookings);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PATCH /api/bookings/:id/cancel — cancel a booking
router.patch('/:id/cancel', authenticate, requireUser, async (req, res) => {
    const { reason } = req.body;
    try {
        const [booking] = await db.query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
        if (booking.length === 0) return res.status(404).json({ message: 'Booking not found' });

        const b = booking[0];
        // Only the customer, the turf owner, or admin can cancel
        if (b.user_id !== req.user.id && req.user.role !== 'super_admin') {
            // Check if requester is the turf owner
            const [turf] = await db.query('SELECT owner_id FROM turfs WHERE id = ?', [b.turf_id]);
            if (!turf[0] || turf[0].owner_id !== req.user.id) return res.status(403).json({ message: 'Forbidden' });
        }

        if (b.status === 'cancelled') return res.status(409).json({ message: 'Already cancelled' });

        await db.query("UPDATE bookings SET status = 'cancelled', cancellation_reason = ? WHERE id = ?",
            [reason || null, req.params.id]);
        await db.query("UPDATE slots SET status = 'available' WHERE id = ?", [b.slot_id]);

        res.json({ message: 'Booking cancelled successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
