const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function run() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    });

    const payout_columns = [
        "ADD COLUMN platform_fee DECIMAL(10,2) DEFAULT 0.00",
        "ADD COLUMN period_start DATETIME DEFAULT NULL",
        "ADD COLUMN period_end DATETIME DEFAULT NULL",
        "ADD COLUMN transaction_ref VARCHAR(255) DEFAULT NULL"
    ];

    for (const col of payout_columns) {
        try {
            await conn.query(`ALTER TABLE payouts ${col}`);
            console.log(`Added to payouts: ${col}`);
        } catch (e) {
            console.log(`Skipped or error for payouts ${col}: ${e.message}`);
        }
    }

    try {
        await conn.query(`ALTER TABLE bookings ADD COLUMN payment_status ENUM('pending','paid','fully_paid','refunded') DEFAULT 'pending'`);
        console.log("Added payment_status to bookings");
    } catch(e) {
        console.log(`Skipped or error for payment_status: ${e.message}`);
    }

    await conn.end();
}

run();
