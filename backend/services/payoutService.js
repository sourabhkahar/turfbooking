// One payout path for manual, bulk and auto payouts. Never records money as sent
// unless RazorpayX accepted the payout; final status comes from the payout.* webhook.
const axios = require('axios');
const db = require('../config/db');
const { getPlatformFeePercent } = require('./settings');

const RZPX_BASE = 'https://api.razorpay.com/v1';
const rzpAuth = () => ({ username: process.env.RAZORPAY_KEY_ID, password: process.env.RAZORPAY_KEY_SECRET });

// Owners are paid only the money the platform actually collected online (bookings.online_amount).
// Cash the owner collected at the venue is already with the owner and is never paid out again.
// Bookings already split to the owner via Razorpay Route are excluded.
const ELIGIBLE = `b.status = 'confirmed' AND b.online_amount > 0 AND b.payout_id IS NULL AND COALESCE(b.settlement_method, 'payout') = 'payout'`;

class PayoutError extends Error {
    constructor(status, message, detail) { super(message); this.status = status; this.detail = detail; }
}

async function getOrCreateContact(owner) {
    if (owner.razorpay_contact_id) return owner.razorpay_contact_id;
    const res = await axios.post(`${RZPX_BASE}/contacts`, {
        name: owner.name,
        email: owner.email,
        contact: owner.phone || '',
        type: 'vendor',
        reference_id: `owner_${owner.id}`,
        notes: { owner_id: String(owner.id) },
    }, { auth: rzpAuth() });
    await db.query('UPDATE users SET razorpay_contact_id = ? WHERE id = ?', [res.data.id, owner.id]);
    return res.data.id;
}

async function createFundAccount(contactId, owner, mode) {
    const payload = mode === 'upi'
        ? { contact_id: contactId, account_type: 'vpa', vpa: { address: owner.upi_id } }
        : {
            contact_id: contactId,
            account_type: 'bank_account',
            bank_account: { name: owner.name, ifsc: owner.ifsc_code, account_number: owner.bank_account_number },
        };
    const res = await axios.post(`${RZPX_BASE}/fund_accounts`, payload, { auth: rzpAuth() });
    await db.query('UPDATE users SET razorpay_fund_account_id = ? WHERE id = ?', [res.data.id, owner.id]);
    return res.data.id;
}

async function processOwnerPayout(ownerId, mode = 'bank_account', payoutType = 'manual') {
    const payoutMode = mode === 'upi' ? 'upi' : 'bank_account';

    const [[owner]] = await db.query(
        `SELECT id, name, email, phone, bank_account_number, ifsc_code, upi_id,
                razorpay_contact_id, razorpay_fund_account_id
         FROM users WHERE id = ? AND role = 'owner'`, [ownerId]
    );
    if (!owner) throw new PayoutError(404, 'Owner not found');
    if (payoutMode === 'bank_account' && (!owner.bank_account_number || !owner.ifsc_code)) {
        throw new PayoutError(400, 'Owner has not filled in bank account details');
    }
    if (payoutMode === 'upi' && !owner.upi_id) throw new PayoutError(400, 'Owner has not filled in UPI details');

    // Razorpay contact + fund account (outside the DB transaction)
    let fundAccountId = owner.razorpay_fund_account_id;
    try {
        const contactId = await getOrCreateContact(owner);
        if (!fundAccountId) fundAccountId = await createFundAccount(contactId, owner, payoutMode);
    } catch (e) {
        throw new PayoutError(502, 'Failed to set up Razorpay fund account', e.response?.data?.error?.description || e.message);
    }

    const feePercent = await getPlatformFeePercent();
    const txnRef = `TPAY-${Date.now()}-${ownerId}`;

    // Reserve eligible bookings for this payout atomically
    const conn = await db.getConnection();
    let payoutId, gross, platformFee, finalAmount;
    try {
        await conn.beginTransaction();
        const [eligible] = await conn.query(
            `SELECT b.id, b.online_amount FROM bookings b JOIN turfs t ON b.turf_id = t.id
             WHERE t.owner_id = ? AND ${ELIGIBLE} FOR UPDATE`, [ownerId]
        );
        gross = Math.round(eligible.reduce((s, b) => s + Number(b.online_amount), 0) * 100) / 100;
        if (gross <= 0) throw new PayoutError(400, 'No pending earnings for this owner');

        platformFee = Math.round(gross * feePercent) / 100;
        finalAmount = Math.round((gross - platformFee) * 100) / 100;

        const [result] = await conn.query(
            `INSERT INTO payouts (owner_id, amount, platform_fee, final_amount, status, payout_mode,
                                  period_start, period_end, transaction_ref, razorpay_fund_account_id, payout_type)
             VALUES (?, ?, ?, ?, 'pending', ?, NOW(), NOW(), ?, ?, ?)`,
            [ownerId, gross, platformFee, finalAmount, payoutMode, txnRef, fundAccountId, payoutType]
        );
        payoutId = result.insertId;
        await conn.query('UPDATE bookings SET payout_id = ? WHERE id IN (?)', [payoutId, eligible.map((b) => b.id)]);
        await conn.commit();
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }

    // Send the money
    let rzpPayoutId = null, status = 'pending', failureReason = null;
    const simulate = process.env.NODE_ENV !== 'production' && process.env.PAYOUT_SIMULATE === 'true';
    if (simulate) {
        rzpPayoutId = `sim_${txnRef}`;
        status = 'processed';
        console.warn(`[payout] SIMULATED payout ${payoutId} (PAYOUT_SIMULATE=true, non-production)`);
    } else {
        try {
            const res = await axios.post(`${RZPX_BASE}/payouts`, {
                account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
                fund_account_id: fundAccountId,
                amount: Math.round(finalAmount * 100),
                currency: 'INR',
                mode: payoutMode === 'upi' ? 'UPI' : 'NEFT',
                purpose: 'payout',
                queue_if_low_balance: true,
                reference_id: txnRef,
                narration: 'Turf booking payout',
                notes: { owner_id: String(ownerId), payout_db_id: String(payoutId) },
            }, { auth: rzpAuth(), headers: { 'X-Payout-Idempotency': txnRef } });
            rzpPayoutId = res.data.id;
            if (res.data.status === 'processed') status = 'processed';
            else if (['rejected', 'cancelled', 'failed', 'reversed'].includes(res.data.status)) {
                status = 'failed';
                failureReason = res.data.status_details?.description || res.data.status;
            }
        } catch (e) {
            status = 'failed';
            failureReason = e.response?.data?.error?.description || e.message;
            console.error('[payout] RazorpayX error:', e.response?.data || e.message);
        }
    }

    await markPayout(payoutId, status, { rzpPayoutId, failureReason });
    if (status === 'failed') throw new PayoutError(502, 'Razorpay payout failed; bookings released for retry', failureReason);

    return { payout_id: payoutId, razorpay_payout_id: rzpPayoutId, status, gross_amount: gross, platform_fee: platformFee, amount: finalAmount };
}

// Updates a payout's status. A failed/reversed payout releases its bookings so they can be paid again.
async function markPayout(payoutId, status, { rzpPayoutId = null, failureReason = null } = {}) {
    await db.query(
        `UPDATE payouts SET status = ?, razorpay_payout_id = COALESCE(?, razorpay_payout_id), failure_reason = ?,
                processed_at = IF(? = 'processed', NOW(), processed_at)
         WHERE id = ?`,
        [status, rzpPayoutId, failureReason, status, payoutId]
    );
    if (status === 'failed') {
        await db.query('UPDATE bookings SET payout_id = NULL WHERE payout_id = ?', [payoutId]);
    }
}

// Owners with eligible earnings and the required bank/UPI details.
async function ownersWithPendingEarnings() {
    const [rows] = await db.query(
        `SELECT DISTINCT u.id AS owner_id, u.name AS owner_name
         FROM users u JOIN turfs t ON u.id = t.owner_id JOIN bookings b ON t.id = b.turf_id
         WHERE ${ELIGIBLE} AND u.bank_account_number IS NOT NULL AND u.ifsc_code IS NOT NULL`
    );
    return rows;
}

async function processAllPayouts(payoutType = 'manual') {
    const results = [];
    for (const { owner_id, owner_name } of await ownersWithPendingEarnings()) {
        try {
            const r = await processOwnerPayout(owner_id, 'bank_account', payoutType);
            results.push({ owner_id, owner_name, ...r });
        } catch (e) {
            results.push({ owner_id, owner_name, status: 'failed', error: e.message, detail: e.detail });
        }
    }
    return results;
}

module.exports = { processOwnerPayout, processAllPayouts, markPayout, PayoutError, ELIGIBLE };
