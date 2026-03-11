const db = require('./db');

// Initialize SQLite database with schema
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const schemas = [
            // Create users table
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                state TEXT NOT NULL,
                role TEXT DEFAULT 'user' CHECK(role IN ('user', 'agent', 'admin')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                deleted_at DATETIME DEFAULT NULL
            )`,

            // Create wallets table
            `CREATE TABLE IF NOT EXISTS wallets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                balance DECIMAL(15,2) DEFAULT 0.00,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,

            // Create waste_submissions table
            `CREATE TABLE IF NOT EXISTS waste_submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                agent_id INTEGER,
                material_type TEXT NOT NULL CHECK(material_type IN ('PET', 'HDPE', 'Aluminum', 'Paper')),
                weight_kg DECIMAL(10,3) NOT NULL,
                location TEXT NOT NULL,
                payout DECIMAL(15,2) NOT NULL,
                co2_saved DECIMAL(10,3) NOT NULL,
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'collected')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (agent_id) REFERENCES users(id)
            )`,

            // Create withdrawal_requests table
            `CREATE TABLE IF NOT EXISTS withdrawal_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                method TEXT NOT NULL CHECK(method IN ('airtime', 'mobile_data', 'bank_transfer')),
                phone_number TEXT,
                bank_details TEXT,
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`,

            // Create indexes
            `CREATE INDEX IF NOT EXISTS idx_waste_user ON waste_submissions(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_waste_status ON waste_submissions(status)`,
            `CREATE INDEX IF NOT EXISTS idx_waste_created ON waste_submissions(created_at)`,
            `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
            `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,
            `CREATE INDEX IF NOT EXISTS idx_withdrawal_user ON withdrawal_requests(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON withdrawal_requests(status)`,

            // Add soft delete column if missing
            `ALTER TABLE users ADD COLUMN deleted_at DATETIME`
        ];

        let completed = 0;
        let hasError = false;

        function runNextSchema() {
            if (completed >= schemas.length) {
                if (!hasError) {
                    console.log('✓ Database schema initialized successfully');
                    resolve();
                }
                return;
            }

            const schema = schemas[completed++];
            db.run(schema, (err) => {
                if (
                    err
                    && !err.message.includes('already exists')
                    && !err.message.includes('duplicate column name')
                ) {
                    console.error('✗ Schema error:', err.message);
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
