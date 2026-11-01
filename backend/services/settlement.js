// How owners receive booking money.
//   route  (default) — Razorpay Route splits each payment: owner share goes straight to the
//                      owner's linked account, platform keeps its commission.
//   payout           — platform collects everything and pays owners later via RazorpayX.
const axios = require('axios');
const db = require('../config/db');

const settlementMode = () => (process.env.SETTLEMENT_MODE === 'payout' ? 'payout' : 'route');

// Owner must have a linked account before customers can pay online in route mode.
async function ownerCanReceive(ownerId) {
    if (settlementMode() !== 'route') return true;
    const [[u]] = await db.query('SELECT razorpay_linked_account_id FROM users WHERE id = ?', [ownerId]);
    return !!u?.razorpay_linked_account_id;
}

// Composite linked-account onboarding: account + bank settlement destination in one call.
// Docs: https://razorpay.com/docs/api/payments/route/create-linked-account-composite.md
async function createLinkedAccount(owner, { accountNumber, ifsc, beneficiaryName }) {
    const res = await axios.post('https://api.razorpay.com/v2/accounts', {
        type: 'route',
        tnc_accepted: true,
        reference_id: `owner_${owner.id}`,
        legal_business_name: beneficiaryName,
        business_type: 'individual',
        email: owner.email,
        ...(owner.phone ? { phone: owner.phone } : {}),
        notes: { owner_id: String(owner.id) },
        settlement_accounts: [{
            method: 'bank_account',
            bank_account: {
                account_number: accountNumber,
                beneficiary_name: beneficiaryName,
                code_type: 'ifsc',
                code: ifsc,
                currency: 'INR',
                is_default: true,
            },
        }],
    }, {
        auth: { username: process.env.RAZORPAY_KEY_ID, password: process.env.RAZORPAY_KEY_SECRET },
        headers: { 'Idempotency-Key': `owner_${owner.id}_${accountNumber.slice(-4)}` },
    });
    return res.data;
}

async function fetchLinkedAccount(accountId) {
    const res = await axios.get(`https://api.razorpay.com/v2/accounts/${encodeURIComponent(accountId)}`, {
        auth: { username: process.env.RAZORPAY_KEY_ID, password: process.env.RAZORPAY_KEY_SECRET },
    });
    return res.data;
}

module.exports = { settlementMode, ownerCanReceive, createLinkedAccount, fetchLinkedAccount };
