const db = require('../config/db');

// Platform commission (%) taken from owner earnings. One source of truth:
// app_settings.platform_fee_percent, falling back to PLATFORM_FEE_PERCENT env, then 2.
async function getPlatformFeePercent() {
    try {
        const [rows] = await db.query(
            "SELECT setting_value FROM app_settings WHERE setting_key = 'platform_fee_percent' LIMIT 1"
        );
        const v = parseFloat(rows[0]?.setting_value);
        if (!Number.isNaN(v) && v >= 0 && v < 100) return v;
    } catch (_) { /* table may not exist yet */ }
    const envV = parseFloat(process.env.PLATFORM_FEE_PERCENT);
    return !Number.isNaN(envV) && envV >= 0 && envV < 100 ? envV : 2;
}

module.exports = { getPlatformFeePercent };
