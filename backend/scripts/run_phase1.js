// Migrations (Phase 1 + Route settlement + subscription plans). Safe to run more than once: each step is
// skipped if it was already applied. Run from backend/:  npm run migrate
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

const steps = [
    ['bookings.online_amount column',
        'ALTER TABLE bookings ADD COLUMN online_amount DECIMAL(10,2) DEFAULT NULL'],
    ['backfill online_amount for paid bookings',
        `UPDATE bookings b JOIN turfs t ON b.turf_id = t.id
         SET b.online_amount = CASE WHEN b.payment_type = 'part' AND t.part_payment_percentage > 0
                                    THEN ROUND(b.total_amount * t.part_payment_percentage / 100, 2)
                                    ELSE b.total_amount END
         WHERE b.payment_id IS NOT NULL AND b.online_amount IS NULL`],
    ['bookings.status enum',
        "ALTER TABLE bookings MODIFY COLUMN status ENUM('pending','confirmed','cancelled','failed') DEFAULT 'pending'"],
    ['bookings order index', 'CREATE INDEX idx_bookings_order ON bookings (razorpay_order_id)'],
    ['bookings turf/date index', 'CREATE INDEX idx_bookings_turf_date ON bookings (turf_id, booking_date)'],
    ['payouts.platform_fee', 'ALTER TABLE payouts ADD COLUMN platform_fee DECIMAL(10,2) DEFAULT 0.00'],
    ['payouts.razorpay_payout_id', 'ALTER TABLE payouts ADD COLUMN razorpay_payout_id VARCHAR(100) DEFAULT NULL'],
    ['payouts.razorpay_fund_account_id', 'ALTER TABLE payouts ADD COLUMN razorpay_fund_account_id VARCHAR(100) DEFAULT NULL'],
    ['payouts.payout_mode', "ALTER TABLE payouts ADD COLUMN payout_mode ENUM('bank_account','upi') DEFAULT 'bank_account'"],
    ['payouts.failure_reason', 'ALTER TABLE payouts ADD COLUMN failure_reason TEXT DEFAULT NULL'],
    ['payouts.payout_type', "ALTER TABLE payouts ADD COLUMN payout_type ENUM('manual','auto') DEFAULT 'manual'"],
    ['payouts.status enum', "ALTER TABLE payouts MODIFY COLUMN status ENUM('pending','processed','failed') DEFAULT 'pending'"],
    ['subscriptions: unique order id', 'CREATE UNIQUE INDEX uq_sub_order ON owner_subscriptions (razorpay_order_id)'],
    ['subscriptions: unique payment id', 'CREATE UNIQUE INDEX uq_sub_payment ON owner_subscriptions (razorpay_payment_id)'],
    ['app_settings table',
        `CREATE TABLE IF NOT EXISTS app_settings (
            setting_key VARCHAR(100) PRIMARY KEY,
            setting_value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`],
    ['default platform fee 2%',
        "INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES ('platform_fee_percent', '2')"],

    // ── Route settlement ──
    ['users.route_status', 'ALTER TABLE users ADD COLUMN route_status VARCHAR(50) DEFAULT NULL'],
    ['users.razorpay_linked_account_id', 'ALTER TABLE users ADD COLUMN razorpay_linked_account_id VARCHAR(100) DEFAULT NULL'],
    ['bookings.settlement_method', "ALTER TABLE bookings ADD COLUMN settlement_method ENUM('route','payout') DEFAULT NULL"],

    // ── Subscription plans: tiers × monthly/annual + trial ──
    ['plans table',
        `CREATE TABLE IF NOT EXISTS plans (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(50) NOT NULL UNIQUE,
            name VARCHAR(100) NOT NULL,
            tier ENUM('starter','pro') NOT NULL,
            billing_interval ENUM('month','year') NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            max_turfs INT DEFAULT NULL,
            allow_booking_links TINYINT(1) NOT NULL DEFAULT 0,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            sort_order INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`],
    ['seed default plans (edit prices in Admin → Plans)',
        `INSERT IGNORE INTO plans (code, name, tier, billing_interval, price, max_turfs, allow_booking_links, sort_order) VALUES
            ('starter_monthly', 'Starter Monthly', 'starter', 'month', 499, 1, 0, 1),
            ('starter_annual',  'Starter Annual',  'starter', 'year', 4990, 1, 0, 2),
            ('pro_monthly',     'Pro Monthly',     'pro',     'month', 999, 5, 1, 3),
            ('pro_annual',      'Pro Annual',      'pro',     'year', 9990, 5, 1, 4)`],
    ['owner_subscriptions.plan_id', 'ALTER TABLE owner_subscriptions ADD COLUMN plan_id INT DEFAULT NULL'],
    ['owner_subscriptions.is_trial', 'ALTER TABLE owner_subscriptions ADD COLUMN is_trial TINYINT(1) NOT NULL DEFAULT 0'],
    ['owner_subscriptions lookup index', 'CREATE INDEX idx_sub_owner_window ON owner_subscriptions (owner_id, status, start_date, end_date)'],
    ['trial: 14 days of Pro Monthly',
        "INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES ('trial_days', '14'), ('trial_plan_code', 'pro_monthly')"],
];

const ALREADY = new Set(['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME']);

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME, port: process.env.DB_PORT || 3306,
    });
    let failed = 0;
    for (const [name, sql] of steps) {
        try {
            const [r] = await conn.query(sql);
            console.log(`✅ ${name}${r && r.affectedRows ? ` (${r.affectedRows} rows)` : ''}`);
        } catch (e) {
            if (ALREADY.has(e.code)) console.log(`↷  ${name} — already applied`);
            else { failed++; console.error(`❌ ${name}: ${e.code} ${e.message}`); }
        }
    }
    await conn.end();
    console.log(failed ? `\n${failed} step(s) failed — fix them before starting the server.` : '\nPhase 1 migration complete.');
    process.exit(failed ? 1 : 0);
})();
