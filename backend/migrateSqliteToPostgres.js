const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const db = require('./db');

const sqlitePath = path.join(__dirname, '..', 'ecowallet.db');
const force = process.argv.includes('--force');

function openSqlite() {
    return new sqlite3.Database(sqlitePath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('Failed to open SQLite DB:', err.message);
            process.exit(1);
        }
    });
}

function sqliteAll(sqliteDb, sql, params = []) {
    return new Promise((resolve, reject) => {
        sqliteDb.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

async function main() {
    const sqliteDb = openSqlite();
    const client = await db.pool.connect();

    try {
        const existing = await client.query('SELECT COUNT(*)::int AS count FROM users');
        if (existing.rows[0].count > 0 && !force) {
            throw new Error('Postgres already has data. Re-run with --force to wipe and import.');
        }

        await client.query('BEGIN');

        if (force) {
            await client.query('TRUNCATE TABLE withdrawal_requests RESTART IDENTITY CASCADE');
            await client.query('TRUNCATE TABLE waste_submissions RESTART IDENTITY CASCADE');
            await client.query('TRUNCATE TABLE wallets RESTART IDENTITY CASCADE');
            await client.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
        }

        const users = await sqliteAll(sqliteDb, 'SELECT * FROM users');
        for (const user of users) {
            await client.query(
                `INSERT INTO users (id, name, email, password, state, role, created_at, updated_at, deleted_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [
                    user.id,
                    user.name,
                    user.email,
                    user.password,
                    user.state,
                    user.role,
                    user.created_at,
                    user.updated_at,
                    user.deleted_at
                ]
            );
        }

        const wallets = await sqliteAll(sqliteDb, 'SELECT * FROM wallets');
        for (const wallet of wallets) {
            await client.query(
                `INSERT INTO wallets (id, user_id, balance, created_at, updated_at)
                 VALUES ($1,$2,$3,$4,$5)`,
                [
                    wallet.id,
                    wallet.user_id,
                    wallet.balance,
                    wallet.created_at,
                    wallet.updated_at
                ]
            );
        }

        const submissions = await sqliteAll(sqliteDb, 'SELECT * FROM waste_submissions');
        for (const row of submissions) {
            await client.query(
                `INSERT INTO waste_submissions
                (id, user_id, agent_id, material_type, weight_kg, location, payout, co2_saved, status, created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                [
                    row.id,
                    row.user_id,
                    row.agent_id,
                    row.material_type,
                    row.weight_kg,
                    row.location,
                    row.payout,
                    row.co2_saved,
                    row.status,
                    row.created_at,
                    row.updated_at
                ]
            );
        }

        const withdrawals = await sqliteAll(sqliteDb, 'SELECT * FROM withdrawal_requests');
        for (const row of withdrawals) {
            await client.query(
                `INSERT INTO withdrawal_requests
                (id, user_id, amount, method, phone_number, bank_details, status, created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [
                    row.id,
                    row.user_id,
                    row.amount,
                    row.method,
                    row.phone_number,
                    row.bank_details,
                    row.status,
                    row.created_at,
                    row.updated_at
                ]
            );
        }

        await client.query(`SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1))`);
        await client.query(`SELECT setval('wallets_id_seq', COALESCE((SELECT MAX(id) FROM wallets), 1))`);
        await client.query(`SELECT setval('waste_submissions_id_seq', COALESCE((SELECT MAX(id) FROM waste_submissions), 1))`);
        await client.query(`SELECT setval('withdrawal_requests_id_seq', COALESCE((SELECT MAX(id) FROM withdrawal_requests), 1))`);

        await client.query('COMMIT');
        console.log('Migration completed successfully.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err.message);
        process.exit(1);
    } finally {
        sqliteDb.close();
        client.release();
    }
}

main();
