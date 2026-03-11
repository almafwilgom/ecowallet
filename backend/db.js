const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

// Create SQLite database file in project root
const dbPath = path.join(__dirname, '..', 'ecowallet.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('✗ Database connection error:', err.message);
        process.exit(1);
    }
    console.log('✓ Connected to SQLite database at', dbPath);
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

module.exports = db;
