const db = require('../db');
const { MATERIAL_PRICES, CO2_CONVERSION } = require('./authController');

const submitWaste = async (req, res) => {
    try {
        const { material_type, weight_kg, location } = req.body;
        const user_id = req.user.id;

        if (!material_type || !weight_kg || !location) {
            return res.status(400).json({ error: 'All fields required' });
        }

        if (!MATERIAL_PRICES[material_type]) {
            return res.status(400).json({ error: 'Invalid material type' });
        }

        const payout = weight_kg * MATERIAL_PRICES[material_type];
        const co2_saved = weight_kg * CO2_CONVERSION[material_type];

        // Insert waste submission
        const insertResult = db.prepare(
            'INSERT INTO waste_submissions (user_id, material_type, weight_kg, location, payout, co2_saved, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(user_id, material_type, weight_kg, location, payout, co2_saved, 'pending');

        // Update wallet balance
        db.prepare('UPDATE wallets SET balance = balance + ? WHERE user_id = ?').run(payout, user_id);

        res.status(201).json({
            message: 'Waste submitted successfully',
            submission: {
                id: insertResult.lastInsertRowid,
                payout,
                co2_saved,
                reward_message: `You earned ₦${payout} and saved ${co2_saved}kg of CO2!`
            }
        });
    } catch (error) {
        console.error('Submit waste error:', error);
        res.status(500).json({ error: 'Failed to submit waste' });
    }
};

const getUserSubmissions = (req, res) => {
    try {
        const user_id = req.user.id;
        const { status } = req.query;

        let query = 'SELECT * FROM waste_submissions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50';
        let params = [user_id];

        if (status) {
            query = 'SELECT * FROM waste_submissions WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 50';
            params = [user_id, status];
        }

        const submissions = db.prepare(query).all(...params);
        res.json({ submissions });
    } catch (error) {
        console.error('Get submissions error:', error);
        res.status(500).json({ error: 'Failed to get submissions' });
    }
};

const getLeaderboard = (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const leaderboard = db.prepare(`
            SELECT 
                u.id,
                u.name,
                COUNT(*) as submission_count,
                COALESCE(SUM(ws.weight_kg), 0) as total_waste_kg,
                COALESCE(SUM(ws.co2_saved), 0) as total_co2_saved
            FROM users u
            LEFT JOIN waste_submissions ws ON u.id = ws.user_id AND ws.status = 'collected'
            WHERE u.role = 'user'
            GROUP BY u.id, u.name
            ORDER BY total_waste_kg DESC
            LIMIT ?
        `).all(limit);

        res.json({ leaderboard });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ error: 'Failed to get leaderboard' });
    }
};

const getUserStats = (req, res) => {
    try {
        const user_id = req.user.id;

        const stats = db.prepare(`
            SELECT
                COUNT(CASE WHEN ws.status = 'pending' THEN 1 END) as pending_submissions,
                COUNT(CASE WHEN ws.status = 'collected' THEN 1 END) as collected_submissions,
                COALESCE(SUM(CASE WHEN ws.status = 'collected' THEN ws.weight_kg ELSE 0 END), 0) as total_weight_kg,
                COALESCE(SUM(CASE WHEN ws.status = 'collected' THEN ws.co2_saved ELSE 0 END), 0) as total_co2_saved,
                COALESCE(SUM(CASE WHEN ws.status = 'collected' THEN ws.payout ELSE 0 END), 0) as total_earned,
                COALESCE(w.balance, 0) as wallet_balance
            FROM waste_submissions ws
            LEFT JOIN wallets w ON ws.user_id = w.user_id
            WHERE ws.user_id = ?
        `).get(user_id);

        res.json({ stats: stats || {} });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
};

module.exports = {
    submitWaste,
    getUserSubmissions,
    getLeaderboard,
    getUserStats
};
