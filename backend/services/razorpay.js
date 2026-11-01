// Single Razorpay client + signature helpers used across the app.
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

function safeEqual(a, b) {
    const bufA = Buffer.from(String(a || ''));
    const bufB = Buffer.from(String(b || ''));
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// Checkout signature: HMAC(order_id|payment_id, key_secret)
function verifyPaymentSignature(orderId, paymentId, signature) {
    const expected = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
    return safeEqual(expected, signature);
}

// Webhook signature: HMAC(raw body, webhook secret)
function verifyWebhookSignature(rawBody, signature) {
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) return false;
    const expected = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');
    return safeEqual(expected, signature);
}

const toPaise = (rupees) => Math.round(Number(rupees) * 100);

module.exports = { razorpay, verifyPaymentSignature, verifyWebhookSignature, toPaise };
