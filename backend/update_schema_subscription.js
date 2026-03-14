const db = require('./config/db');

async function run() {
    try {
        console.log("Starting database update for Subscriptions and Payouts...");

        // 1. Owner Subscriptions Table
        await db.query(`
            CREATE TABLE IF NOT EXISTS owner_subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                owner_id INT NOT NULL,
                plan_name VARCHAR(100) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                status ENUM('active', 'expired', 'pending') DEFAULT 'pending',
                start_date DATETIME NOT NULL,
                end_date DATETIME NOT NULL,
                razorpay_order_id VARCHAR(255),
                razorpay_payment_id VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // 2. Payouts Table
        await db.query(`
            CREATE TABLE IF NOT EXISTS payouts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                owner_id INT NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                platform_commission DECIMAL(10,2) DEFAULT 0,
                final_amount DECIMAL(10,2) NOT NULL,
                status ENUM('pending', 'processed') DEFAULT 'pending',
                period_start DATE NOT NULL,
                period_end DATE NOT NULL,
                processed_at DATETIME,
                transaction_ref VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // 3. Add payout_id to bookings to track which ones are paid out
        const [columns] = await db.query("SHOW COLUMNS FROM bookings LIKE 'payout_id'");
        if (columns.length === 0) {
            await db.query("ALTER TABLE bookings ADD COLUMN payout_id INT DEFAULT NULL");
            await db.query("ALTER TABLE bookings ADD FOREIGN KEY (payout_id) REFERENCES payouts(id) ON DELETE SET NULL");
        }

        console.log("Database update completed successfully.");
    } catch (e) {
        console.error("Error updating database:", e);
    } finally {
        process.exit();
    }
}
run();
