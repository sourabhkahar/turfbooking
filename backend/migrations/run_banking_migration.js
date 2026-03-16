const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const fs = require('fs');

async function runMigration() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        multipleStatements: true
    });

    try {
        const sql = fs.readFileSync(path.join(__dirname, 'add_banking_fields.sql'), 'utf8');
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const stmt of statements) {
            try {
                await conn.query(stmt);
                console.log('✅ Executed:', stmt.substring(0, 60) + '...');
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME' || err.message.includes('Duplicate column')) {
                    console.log('⚠️  Column already exists, skipping.');
                } else {
                    console.error('❌ Error:', err.message);
                }
            }
        }
        console.log('\n✅ Banking migration complete!');
    } finally {
        await conn.end();
    }
}

runMigration().catch(console.error);
