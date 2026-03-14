const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authenticate, requireOwner, requireAdmin, requireUser } = require('../middleware/auth');

const router = express.Router();

// POST /api/bookings — customer books one or more slots
router.post('/', authenticate, requireUser, [
    body('slot_ids').optional().isArray(),
    body('slot_id').optional().isInt(),
    body('notes').optional().isString(),
    body('payment_type').optional().isIn(['full', 'part']),

], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    let { slot_id, slot_ids, notes, payment_type = 'full' } = req.body;

    // Normalize to an array of slot_ids
    if (!slot_ids && slot_id) slot_ids = [slot_id];
    if (!slot_ids || !Array.isArray(slot_ids) || slot_ids.length === 0) {
        return res.status(400).json({ message: 'No slots specified' });
    }

    const conn = await (require('../config/db')).getConnection();
    try {
        await conn.beginTransaction();

        const bookingIds = [];
        let totalBookingAmount = 0;
        let turfName = '';
        let bookingDate = '';
        const timeRanges = [];
        let turfInfo = null;

        for (const sId of slot_ids) {
            // Lock the slot row
            const [slots] = await conn.query('SELECT * FROM slots WHERE id = ? FOR UPDATE', [sId]);
            if (slots.length === 0) {
                await conn.rollback();
                return res.status(404).json({ message: `Slot ${sId} not found` });
            }
            const slot = slots[0];

            if (slot.status !== 'available') {
                await conn.rollback();
                return res.status(409).json({ message: `Slot ${slot.start_time} is ${slot.status}. Cannot book.` });
            }

            // Get turf info (only once)
            if (!turfInfo) {
                const [turfs] = await conn.query('SELECT * FROM turfs WHERE id = ?', [slot.turf_id]);
                turfInfo = turfs[0];
                turfName = turfInfo.name;
                bookingDate = slot.date;
            }

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

            // Create booking row
            const [result] = await conn.query(
                `INSERT INTO bookings (slot_id, user_id, turf_id, booking_date, start_time, end_time, 
            duration_hours, price_per_hour, total_amount, paid_amount, remaining_amount, payment_type, payment_status, status, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [sId, req.user.id, slot.turf_id, slot.date, slot.start_time, slot.end_time,
                    durationHours, pricePerHour, totalAmount, 0, totalAmount, payment_type, 'unpaid', 'pending', notes || null]
            );

            const bId = result.insertId;
            bookingIds.push(bId);
            totalBookingAmount += totalAmount;
            timeRanges.push(`${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)}`);

            // Mark slot as booked
            await conn.query("UPDATE slots SET status = 'booked' WHERE id = ?", [sId]);
        }

        await conn.commit();

        const amountToPay = payment_type === 'part' && turfInfo.part_payment_percentage > 0
            ? (totalBookingAmount * turfInfo.part_payment_percentage / 100)
            : totalBookingAmount;

        res.status(201).json({
            message: 'Bookings initialized. Proceed to payment.',
            booking_ids: bookingIds,
            booking_id: bookingIds[0], // For backward compatibility
            total_amount: totalBookingAmount,
            amount_to_pay: amountToPay,
            turf_name: turfName,
            date: bookingDate,
            time: timeRanges.join(', ')
        });

    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    } finally {
        conn.release();
    }
});

router.get('/my', authenticate, requireUser, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM bookings WHERE user_id = ?', [req.user.id]);

        const [bookings] = await db.query(
            `SELECT b.*, t.name as turf_name, t.location, t.city
       FROM bookings b JOIN turfs t ON b.turf_id = t.id
       WHERE b.user_id = ? ORDER BY b.booking_date DESC, b.start_time DESC
       LIMIT ? OFFSET ?`,
            [req.user.id, limit, offset]
        );
        res.json({
            data: bookings,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
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

// POST /api/bookings/rollback — rollback unpaid initialization
router.post('/rollback', authenticate, async (req, res) => {
    const { booking_ids } = req.body;
    if (!booking_ids || !Array.isArray(booking_ids)) return res.status(400).json({ message: 'No IDs provided' });

    try {
        // Only rollback if status is 'pending' and belongs to user
        const [rows] = await db.query('SELECT slot_id FROM bookings WHERE id IN (?) AND user_id = ? AND status = ?', [booking_ids, req.user.id, 'pending']);
        console.log(rows);
        if (rows.length > 0) {
            const slotIds = rows.map(b => b.slot_id);
            await db.query("UPDATE slots SET status = 'available' WHERE id IN (?)", [slotIds]);
            // Instead of deleting, we update status to 'failed' to keep the audit trail
            await db.query("UPDATE bookings SET status = 'failed' WHERE id IN (?) AND status = ?", [booking_ids, 'pending']);
        }

        res.json({ message: 'Rollback successful' });
    } catch (err) {
        console.error('Rollback error:', err);
        res.status(500).json({ message: 'Rollback failed' });
    }
});

module.exports = router;
