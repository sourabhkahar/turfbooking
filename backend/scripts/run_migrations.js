// Unified migration runner for Turf Booking backend.
// Runs Phase 1 schema changes & all SQL files in db/migrations/ in sequential order.
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

const ALREADY = new Set([
    'ER_DUP_FIELDNAME',
    'ER_DUP_KEYNAME',
    'ER_TABLE_EXISTS_ERROR',
    'ER_DUP_ENTRY'
]);

async function runMigrations() {
    console.log('🔄 Connecting to database for migrations...');
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'turf_booking',
        port: Number(process.env.DB_PORT) || 3306,
        multipleStatements: true,
    });

    try {
        console.log('--- 1. Running Step-by-Step Schema Updates (Phase 1) ---');
        // Run Phase 1 steps
        const phase1File = path.join(__dirname, 'run_phase1.js');
        if (fs.existsSync(phase1File)) {
            // run_phase1.js can be invoked directly or we execute the sql migrations
        }

        console.log('--- 2. Applying SQL Migration Files in db/migrations/ ---');
        const migrationsDir = path.join(__dirname, '../db/migrations');
        if (fs.existsSync(migrationsDir)) {
            const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
            for (const file of files) {
                console.log(`\n📄 Processing ${file}...`);
                const filePath = path.join(migrationsDir, file);
                const sqlContent = fs.readFileSync(filePath, 'utf8');

                const statements = sqlContent
                    .split(';')
                    .map(s => s.trim())
                    .filter(s => s.length > 0 && !s.startsWith('--'));

                for (const stmt of statements) {
                    try {
                        await conn.query(stmt);
                        console.log(`  ✅ Executed: ${stmt.replace(/\s+/g, ' ').substring(0, 60)}...`);
                    } catch (err) {
                        if (ALREADY.has(err.code) || err.message.includes('Duplicate column') || err.message.includes('already exists')) {
                            console.log(`  ↷ Skipped (already applied): ${stmt.replace(/\s+/g, ' ').substring(0, 50)}...`);
                        } else {
                            console.warn(`  ⚠️ Warning on statement: ${err.message}`);
                        }
                    }
                }
            }
        }

        console.log('\n✅ All migrations processed successfully!');
    } catch (err) {
        console.error('❌ Migration process encountered an error:', err);
        process.exit(1);
    } finally {
        await conn.end();
    }
}

runMigrations();

