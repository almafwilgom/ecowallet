const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === '1'
        ? { rejectUnauthorized: false }
        : undefined
});

pool.on('error', (err) => {
    console.error('âœ— Database connection error:', err.message);
});

function normalizeArgs(sql, params, callback) {
    if (typeof params === 'function') {
        return { sql, params: [], callback: params };
    }
    return { sql, params: params || [], callback };
}

function toPgPlaceholders(sql) {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
}

async function run(sql, params, callback) {
    const { sql: rawSql, params: rawParams, callback: cb } = normalizeArgs(sql, params, callback);
    let text = toPgPlaceholders(rawSql);
    const values = rawParams;

    if (/^\s*insert/i.test(text) && !/returning\s+/i.test(text)) {
        text = `${text} RETURNING id`;
    }

    try {
        const result = await pool.query(text, values);
        const ctx = {
            lastID: result.rows?.[0]?.id,
            changes: result.rowCount
        };
        if (cb) cb.call(ctx, null);
    } catch (err) {
        if (cb) cb(err);
    }
}

async function get(sql, params, callback) {
    const { sql: rawSql, params: rawParams, callback: cb } = normalizeArgs(sql, params, callback);
    const text = toPgPlaceholders(rawSql);
    const values = rawParams;

    try {
        const result = await pool.query(text, values);
        if (cb) cb(null, result.rows[0]);
    } catch (err) {
        if (cb) cb(err);
    }
}

async function all(sql, params, callback) {
    const { sql: rawSql, params: rawParams, callback: cb } = normalizeArgs(sql, params, callback);
    const text = toPgPlaceholders(rawSql);
    const values = rawParams;

    try {
        const result = await pool.query(text, values);
        if (cb) cb(null, result.rows);
    } catch (err) {
        if (cb) cb(err);
    }
}

function serialize(fn) {
    fn();
}

async function transaction(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = {
    run,
    get,
    all,
    serialize,
    transaction,
    query: (text, values) => pool.query(text, values),
    pool
};
