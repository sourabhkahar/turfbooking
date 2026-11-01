// Server-side source of truth for what a customer owes and for confirming
// bookings after a verified Razorpay payment. Used by /payment/verify and the webhook.
const db = require('../config/db');
const { toPaise } = require('./razorpay');

class PaymentError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}

// Amount due now (in paise) for a set of booking rows joined with turfs.part_payment_percentage
function amountDuePaise(rows) {
    return rows.reduce((sum, b) => {
        const total = Number(b.total_amount);
        const pct = Number(b.part_payment_percentage) || 0;
        const due = b.payment_type === 'part' && pct > 0 ? (total * pct) / 100 : total;
        return sum + toPaise(due);
    }, 0);
}

// Confirms every booking attached to a Razorpay order. Idempotent.
// Returns { newlyConfirmed: [ids] } — empty if already confirmed by an earlier call.
async function confirmOrder({ orderId, paymentId, amountPaise, userId = null }) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query(
            `SELECT b.*, t.part_payment_percentage FROM bookings b
             JOIN turfs t ON b.turf_id = t.id
             WHERE b.razorpay_order_id = ? FOR UPDATE`,
            [orderId]
        );
        if (rows.length === 0) throw new PaymentError(404, 'No bookings found for this order');
        if (userId && rows.some((b) => b.user_id !== userId)) throw new PaymentError(403, 'Order does not belong to you');

        // Already confirmed by this same payment (verify + webhook both arrive) → no-op
        if (rows.every((b) => b.status === 'confirmed' && b.payment_id === paymentId)) {
            await conn.commit();
            return { newlyConfirmed: [] };
        }
        if (rows.some((b) => b.status !== 'pending')) {
            // e.g. hold expired / rolled back before payment landed — needs a refund (Phase 2)
            console.error(`[payment] Order ${orderId} paid (${paymentId}) but bookings not pending:`,
                rows.map((b) => `${b.id}:${b.status}`).join(','));
            throw new PaymentError(409, 'Booking is no longer pending. Please contact support for a refund.');
        }

        const expected = amountDuePaise(rows);
        if (Number(amountPaise) !== expected) {
            console.error(`[payment] Amount mismatch on order ${orderId}: paid ${amountPaise}, expected ${expected}`);
            throw new PaymentError(400, 'Paid amount does not match booking amount');
        }

        for (const b of rows) {
            const total = Number(b.total_amount);
            const pct = Number(b.part_payment_percentage) || 0;
            const isPart = b.payment_type === 'part' && pct > 0;
            const paid = isPart ? Math.round(total * pct) / 100 : total;
            await conn.query(
                `UPDATE bookings SET payment_status = ?, paid_amount = ?, remaining_amount = ?,
                        payment_id = ?, online_amount = ?, status = 'confirmed'
                 WHERE id = ? AND status = 'pending'`,
                [isPart ? 'partially_paid' : 'fully_paid', paid, Math.round((total - paid) * 100) / 100, paymentId, paid, b.id]
            );
        }
        await conn.commit();
        return { newlyConfirmed: rows.map((b) => b.id) };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

module.exports = { amountDuePaise, confirmOrder, PaymentError };
