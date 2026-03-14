const db = require('./config/db');

async function migrate() {
    try {
        console.log('Starting settings migration...');

        // 1. Create app_settings table
        await db.query(`
            CREATE TABLE IF NOT EXISTS app_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // 2. Insert default payout mode
        await db.query(`
            INSERT IGNORE INTO app_settings (setting_key, setting_value)
            VALUES ('payout_mode', 'manual')
        `);

        // 3. Add type column to payouts if it doesn't exist
        try {
            await db.query("ALTER TABLE payouts ADD COLUMN payout_type ENUM('manual', 'auto') DEFAULT 'manual'");
            console.log('Added payout_type to payouts table');
        } catch (e) {
            console.log('payout_type already exists or error adding it');
        }

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
