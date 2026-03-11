const db = require('../db');

const getPendingSubmissions = (req, res) => {
    try {
        db.all(
            `SELECT ws.*, u.name as user_name
            FROM waste_submissions ws
            JOIN users u ON ws.user_id = u.id
            WHERE ws.status = 'pending'
            ORDER BY ws.created_at ASC`,
            (err, rows) => {
                if (err) return res.status(500).json({ error: 'Failed' });
                res.json({ submissions: rows || [] });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

const collectSubmission = (req, res) => {
    try {
        const agent_id = req.user.id;
        const { submission_id } = req.body;

        db.run(
            'UPDATE waste_submissions SET status = ?, agent_id = ? WHERE id = ?',
            ['collected', agent_id, submission_id],
            function(err) {
                if (err || this.changes === 0) return res.status(500).json({ error: 'Failed' });
                res.json({ message: 'Marked as collected' });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

const getCollectedSubmissions = (req, res) => {
    try {
        const agent_id = req.user.id;

        db.all(
            'SELECT * FROM waste_submissions WHERE agent_id = ? AND status = ? ORDER BY created_at DESC LIMIT 50',
            [agent_id, 'collected'],
            (err, rows) => {
                if (err) return res.status(500).json({ error: 'Failed' });
                res.json({ submissions: rows || [] });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

const getAgentStats = (req, res) => {
    try {
        const agent_id = req.user.id;

        db.get(
            `SELECT
                COUNT(*) as total_collections,
                COALESCE(SUM(weight_kg), 0) as total_weight_kg,
                COALESCE(SUM(co2_saved), 0) as total_co2_saved
            FROM waste_submissions
            WHERE agent_id = ? AND status = 'collected'`,
            [agent_id],
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
    getPendingSubmissions,
    collectSubmission,
    getCollectedSubmissions,
    getAgentStats
};
