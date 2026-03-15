const db = require('./db');

// Initialize Postgres database with schema
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const schemas = [
            // Create users table
            `CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                state TEXT NOT NULL,
                role TEXT DEFAULT 'user' CHECK(role IN ('user', 'agent', 'admin')),
                google_id TEXT UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP DEFAULT NULL
            )`,

            // Create wallets table
            `CREATE TABLE IF NOT EXISTS wallets (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE NOT NULL,
                balance NUMERIC(15,2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,

            // Create waste_submissions table
            `CREATE TABLE IF NOT EXISTS waste_submissions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                agent_id INTEGER,
                material_type TEXT NOT NULL CHECK(material_type IN ('PET', 'HDPE', 'Aluminum', 'Paper')),
                weight_kg NUMERIC(10,3) NOT NULL,
                location TEXT NOT NULL,
                payout NUMERIC(15,2) NOT NULL,
                co2_saved NUMERIC(10,3) NOT NULL,
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'collected')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL
            )`,

            // Create withdrawal_requests table
            `CREATE TABLE IF NOT EXISTS withdrawal_requests (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                amount NUMERIC(15,2) NOT NULL,
                method TEXT NOT NULL CHECK(method IN ('airtime', 'mobile_data', 'bank_transfer')),
                phone_number TEXT,
                bank_details TEXT,
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,

            // Create password reset tokens table
            `CREATE TABLE IF NOT EXISTS password_resets (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used_at TIMESTAMP DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,

            // Backfill missing columns if database exists
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL`,

            // Create indexes
            `CREATE INDEX IF NOT EXISTS idx_waste_user ON waste_submissions(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_waste_status ON waste_submissions(status)`,
            `CREATE INDEX IF NOT EXISTS idx_waste_created ON waste_submissions(created_at)`,
            `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
            `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,
            `CREATE INDEX IF NOT EXISTS idx_withdrawal_user ON withdrawal_requests(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON withdrawal_requests(status)`,
            `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)`,
            `CREATE UNIQUE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash)`,
            `CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_resets(expires_at)`
        ];

        let completed = 0;
        let hasError = false;

        function runNextSchema() {
            if (completed >= schemas.length) {
                if (!hasError) {
                    console.log('âœ“ Database schema initialized successfully');
                    resolve();
                }
                return;
            }

            const schema = schemas[completed++];
            db.run(schema, (err) => {
                if (err && !err.message.includes('already exists')) {
                    console.error('âœ— Schema error:', err.message);
                    hasError = true;
                    reject(err);
                } else {
                    runNextSchema();
                }
            });
        }

        runNextSchema();
    });
}

module.exports = initializeDatabase;
