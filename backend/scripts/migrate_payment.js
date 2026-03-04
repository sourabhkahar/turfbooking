const db = require('../config/db');

async function migrate() {
    try {
        console.log('Starting migration...');

        // Update turfs table
        await db.query(`
            ALTER TABLE turfs 
            ADD COLUMN IF NOT EXISTS part_payment_percentage INT DEFAULT 0
        `);
        console.log('✅ Updated turfs table with part_payment_percentage');

        // Update bookings table
        // First, check if columns exist before adding
        const [columns] = await db.query("SHOW COLUMNS FROM bookings");
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('paid_amount')) {
            await db.query("ALTER TABLE bookings ADD COLUMN paid_amount DECIMAL(10,2) DEFAULT 0.00 AFTER total_amount");
        }
        if (!columnNames.includes('remaining_amount')) {
            await db.query("ALTER TABLE bookings ADD COLUMN remaining_amount DECIMAL(10,2) DEFAULT 0.00 AFTER paid_amount");
        }
        if (!columnNames.includes('payment_method')) {
            await db.query("ALTER TABLE bookings ADD COLUMN payment_method ENUM('online', 'cash', 'mixed') DEFAULT 'online' AFTER remaining_amount");
        }
        if (!columnNames.includes('payment_type')) {
            await db.query("ALTER TABLE bookings ADD COLUMN payment_type ENUM('full', 'part') DEFAULT 'full' AFTER payment_method");
        }
        if (!columnNames.includes('cash_payment_received')) {
            await db.query("ALTER TABLE bookings ADD COLUMN cash_payment_received BOOLEAN DEFAULT FALSE AFTER payment_type");
        }

        // Update payment_status ENUM
        // MySQL doesn't support easy enum update without re-definition
        await db.query(`
            ALTER TABLE bookings 
            MODIFY COLUMN payment_status ENUM('pending', 'paid', 'refunded', 'unpaid', 'partially_paid', 'fully_paid') DEFAULT 'unpaid'
        `);

        console.log('✅ Updated bookings table schema');
        console.log('Migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
