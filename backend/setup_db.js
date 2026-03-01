const db = require('./config/db');

async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS booking_tokens (
                token VARCHAR(255) PRIMARY KEY,
                turf_id INT NOT NULL,
                slot_id INT DEFAULT NULL,
                date DATE NOT NULL,
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                created_by INT NOT NULL,
                expires_at DATE NOT NULL,
                status ENUM('active', 'used', 'expired') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (turf_id) REFERENCES turfs(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        // We'll alter expires_at to be a DATETIME to support exact minutes
        await db.query(`ALTER TABLE booking_tokens MODIFY expires_at DATETIME NOT NULL`);
        console.log("Table created and modified.");
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
