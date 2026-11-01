// Validates required environment variables at startup so the server never
// runs with placeholder secrets.
const REQUIRED = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_NAME', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];

function validateEnv() {
    const missing = REQUIRED.filter((k) => !process.env[k] || !String(process.env[k]).trim());
    if (missing.length) {
        console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
        process.exit(1);
    }
    if (process.env.NODE_ENV === 'production') {
        if (String(process.env.JWT_SECRET).length < 32) {
            console.error('❌ JWT_SECRET must be at least 32 characters in production');
            process.exit(1);
        }
        if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
            console.error('❌ RAZORPAY_WEBHOOK_SECRET is required in production');
            process.exit(1);
        }
    }
}

module.exports = { validateEnv };
