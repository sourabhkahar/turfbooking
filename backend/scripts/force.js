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

    const columns = [
        "ADD COLUMN bank_account_number VARCHAR(30) DEFAULT NULL",
        "ADD COLUMN ifsc_code VARCHAR(15) DEFAULT NULL",
        "ADD COLUMN pan VARCHAR(12) DEFAULT NULL",
        "ADD COLUMN upi_id VARCHAR(100) DEFAULT NULL",
        "ADD COLUMN razorpay_contact_id VARCHAR(100) DEFAULT NULL",
        "ADD COLUMN razorpay_fund_account_id VARCHAR(100) DEFAULT NULL"
    ];

    for (const col of columns) {
        try {
            await conn.query(`ALTER TABLE users ${col}`);
            console.log(`Added: ${col}`);
        } catch (e) {
            console.log(`Skipped or error for ${col}: ${e.message}`);
        }
    }

    const payout_columns = [
        "ADD COLUMN razorpay_payout_id VARCHAR(100) DEFAULT NULL",
        "ADD COLUMN razorpay_fund_account_id VARCHAR(100) DEFAULT NULL",
        "ADD COLUMN payout_mode ENUM('bank_account','upi') DEFAULT 'bank_account'",
        "ADD COLUMN failure_reason TEXT DEFAULT NULL"
    ];

    for (const col of payout_columns) {
        try {
            await conn.query(`ALTER TABLE payouts ${col}`);
            console.log(`Added to payouts: ${col}`);
        } catch (e) {
            console.log(`Skipped or error for payouts ${col}: ${e.message}`);
        }
    }
    
    // add to bookings
    const booking_cols = [
        "ADD COLUMN payout_id INT DEFAULT NULL"
    ];
    for (const col of booking_cols) {
        try {
            await conn.query(`ALTER TABLE bookings ${col}`);
            console.log(`Added to bookings: ${col}`);
        } catch (e) {
            console.log(`Skipped or error for bookings ${col}: ${e.message}`);
        }
    }

    await conn.end();
}

run();
