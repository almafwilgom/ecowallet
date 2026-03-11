const db = require('../db');
const { MATERIAL_PRICES, CO2_CONVERSION } = require('./authController');

const submitWaste = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { material_type, weight_kg, location } = req.body;

        if (!material_type || !weight_kg || !location) {
            return res.status(400).json({ error: 'All fields required' });
        }

        if (!MATERIAL_PRICES[material_type]) {
            return res.status(400).json({ error: 'Invalid material' });
        }

        const payout = weight_kg * MATERIAL_PRICES[material_type];
        const co2_saved = weight_kg * CO2_CONVERSION[material_type];

        db.run(
            'INSERT INTO waste_submissions (user_id, material_type, weight_kg, location, payout, co2_saved, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [user_id, material_type, weight_kg, location, payout, co2_saved, 'pending'],
            function(err) {
                if (err) return res.status(500).json({ error: 'Failed' });

                db.run(
                    'UPDATE wallets SET balance = balance + ? WHERE user_id = ?',
                    [payout, user_id],
                    (err) => {
                        if (err) return res.status(500).json({ error: 'Failed' });
                        res.status(201).json({
                            message: 'Waste submitted',
                            reward: {
                                message: 'Waste submitted',
                                amount: payout
                            },
                            submission: { id: this.lastID, payout, co2_saved }
                        });
                    }
                );
            }
        );
    } catch (error) {
        console.error('Error:',error);
        res.status(500).json({ error: 'Failed' });
    }
};

const getUserSubmissions = (req, res) => {
    try {
        const user_id = req.user.id;
        const { status } = req.query;

        let sql = 'SELECT * FROM waste_submissions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50';
        let params = [user_id];

        if (status) {
            sql = 'SELECT * FROM waste_submissions WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 50';
            params = [user_id, status];
        }

        db.all(sql, params, (err, rows) => {
            if (err) return res.status(500).json({ error: 'Failed' });
            res.json({ submissions: rows || [] });
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

const getLeaderboard = (req, res) => {
    try {
        const limit = req.query.limit || 10;

        db.all(
            `SELECT u.id, u.name, 
                    COUNT(*) as submission_count,
                    COALESCE(SUM(ws.weight_kg), 0) as total_waste_kg,
                    COALESCE(SUM(ws.co2_saved), 0) as total_co2_saved
            FROM users u
            LEFT JOIN waste_submissions ws ON u.id = ws.user_id AND ws.status = 'collected'
            WHERE u.role = 'user' AND u.deleted_at IS NULL
            GROUP BY u.id, u.name
            ORDER BY total_waste_kg DESC
            LIMIT ?`,
            [limit],
            (err, rows) => {
                if (err) return res.status(500).json({ error: 'Failed' });
                res.json({ leaderboard: rows || [] });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

const getUserStats = (req, res) => {
    try {
        const user_id = req.user.id;

        db.get(
            `SELECT
                COUNT(CASE WHEN ws.status = 'pending' THEN 1 END) as pending_submissions,
                COUNT(CASE WHEN ws.status = 'collected' THEN 1 END) as collected_submissions,
                COALESCE(SUM(CASE WHEN ws.status = 'collected' THEN ws.weight_kg ELSE 0 END), 0) as total_weight_kg,
                COALESCE(SUM(CASE WHEN ws.status = 'collected' THEN ws.co2_saved ELSE 0 END), 0) as total_co2_saved,
                COALESCE(SUM(CASE WHEN ws.status = 'collected' THEN ws.payout ELSE 0 END), 0) as total_earned,
                COALESCE(w.balance, 0) as wallet_balance
            FROM waste_submissions ws
            LEFT JOIN wallets w ON ws.user_id = w.user_id
            WHERE ws.user_id = ?`,
            [user_id],
            (err, row) => {
                if (err) return res.status(500).json({ error: 'Failed' });
                res.json({ stats: row || {} });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

module.exports = {
    submitWaste,
    getUserSubmissions,
    getLeaderboard,
    getUserStats
};
