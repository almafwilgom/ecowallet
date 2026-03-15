const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const initializeDatabase = require('./initDb');
const authRoutes = require('./routes/authRoutes');
const wasteRoutes = require('./routes/wasteRoutes');
const walletRoutes = require('./routes/walletRoutes');
const agentRoutes = require('./routes/agentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());

const isLocalhostOrigin = (origin) => {
    if (!origin) return false;
    return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
};

const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:5500',
    'http://localhost:8080',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:8080'
].filter(Boolean);

const allowNullOrigin = process.env.NODE_ENV !== 'production';

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) {
            return allowNullOrigin
                ? callback(null, true)
                : callback(new Error('Not allowed by CORS'));
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        if (process.env.NODE_ENV !== 'production' && isLocalhostOrigin(origin)) {
            return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express.json());

// API Routes
app.use('/auth', authRoutes);
app.use('/waste', wasteRoutes);
app.use('/wallet', walletRoutes);
app.use('/agent', agentRoutes);
app.use('/admin', adminRoutes);

// Public stats (no auth)
app.get('/public/stats', (req, res) => {
    db.get(
        `SELECT
            (SELECT COUNT(*) FROM users WHERE role = 'user' AND deleted_at IS NULL) as total_users,
            COALESCE((SELECT SUM(weight_kg) FROM waste_submissions), 0) as total_waste_recycled_kg,
            COALESCE((SELECT SUM(co2_saved) FROM waste_submissions), 0) as total_co2_saved_kg
        `,
        (err, row) => {
            if (err) return res.status(500).json({ error: 'Failed' });
            res.json({ stats: row || {} });
        }
    );
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`\n========================================`);
            console.log(`🌱 EcoWallet Backend Server`);
            console.log(`========================================`);
            console.log(`✓ Server running on port ${PORT}`);
            console.log(`✓ Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5500'}`);
            console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`========================================\n`);
        });
    })
    .catch((err) => {
        console.error('✗ Failed to initialize database:', err);
        process.exit(1);
    });

module.exports = app;
