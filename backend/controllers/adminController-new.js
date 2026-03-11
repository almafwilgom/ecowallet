const db = require('../db');

const getPlatformStats = (req, res) => {
    try {
        db.get(
            `SELECT
                (SELECT COUNT(*) FROM users WHERE role = 'user') as total_users,
                (SELECT COUNT(*) FROM users WHERE role = 'agent') as total_agents,
                (SELECT COUNT(*) FROM users WHERE role = 'admin') as total_admins,
                COALESCE((SELECT SUM(weight_kg) FROM waste_submissions WHERE status = 'collected'), 0) as total_waste_recycled_kg,
                COALESCE((SELECT SUM(co2_saved) FROM waste_submissions WHERE status = 'collected'), 0) as total_co2_saved_kg,
                COALESCE((SELECT SUM(payout) FROM waste_submissions WHERE status = 'collected'), 0) as total_payouts,
                (SELECT COUNT(*) FROM waste_submissions WHERE status = 'pending') as pending_submissions,
                (SELECT COUNT(*) FROM withdrawal_requests WHERE status = 'pending') as pending_withdrawals`,
            (err, row) => {
                if (err) return res.status(500).json({ error: 'Failed' });
                res.json({ stats: row || {} });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

const getPendingWithdrawals = (req, res) => {
    try {
        db.all(
            `SELECT wr.*, u.name, u.email
            FROM withdrawal_requests wr
            JOIN users u ON wr.user_id = u.id
            WHERE wr.status = 'pending'
            ORDER BY wr.created_at DESC`,
            (err, rows) => {
                if (err) return res.status(500).json({ error: 'Failed' });
                res.json({ withdrawals: rows || [] });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

const approveWithdrawal = (req, res) => {
    try {
        const { withdrawal_id, status } = req.body;

        if (!status || !['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        db.get(
            'SELECT * FROM withdrawal_requests WHERE id = ?',
            [withdrawal_id],
            (err, withdrawal) => {
                if (err || !withdrawal) return res.status(500).json({ error: 'Failed' });

                db.run(
                    'UPDATE withdrawal_requests SET status = ? WHERE id = ?',
                    [status, withdrawal_id],
                    function(err) {
                        if (err) return res.status(500).json({ error: 'Failed' });

                        if (status === 'rejected') {
                            db.run(
                                'UPDATE wallets SET balance = balance + ? WHERE user_id = ?',
                                [withdrawal.amount, withdrawal.user_id],
                                (err) => {
                                    if (err) return res.status(500).json({ error: 'Failed' });
                                    res.json({ message: 'Withdrawal ' + status });
                                }
                            );
                        } else {
                            res.json({ message: 'Withdrawal ' + status });
                        }
                    }
                );
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

const getAllSubmissions = (req, res) => {
    try {
        const { status } = req.query;

        let sql = 'SELECT * FROM waste_submissions ORDER BY created_at DESC LIMIT 100';
        let params = [];

        if (status) {
            sql = 'SELECT * FROM waste_submissions WHERE status = ? ORDER BY created_at DESC LIMIT 100';
            params = [status];
        }

        db.all(sql, params, (err, rows) => {
            if (err) return res.status(500).json({ error: 'Failed' });
            res.json({ submissions: rows || [] });
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

const getAllUsers = (req, res) => {
    try {
        const { role } = req.query;

        let sql = 'SELECT id, name, email, state, role, created_at FROM users ORDER BY created_at DESC';
        let params = [];

        if (role) {
            sql = 'SELECT id, name, email, state, role, created_at FROM users WHERE role = ? ORDER BY created_at DESC';
            params = [role];
        }

        db.all(sql, params, (err, rows) => {
            if (err) return res.status(500).json({ error: 'Failed' });
            res.json({ users: rows || [] });
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

const createAgent = (req, res) => {
    try {
        const { name, email, password, state } = req.body;
        const bcrypt = require('bcrypt');

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields required' });
        }

        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) return res.status(500).json({ error: 'Failed' });

            db.run(
                'INSERT INTO users (name, email, password, state, role) VALUES (?, ?, ?, ?, ?)',
                [name, email, hashedPassword, state || 'Nigeria', 'agent'],
                function(err) {
                    if (err) return res.status(500).json({ error: 'Email exists' });
                    res.status(201).json({ message: 'Agent created', id: this.lastID });
                }
            );
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

const createAdmin = (req, res) => {
    try {
        const { name, email, password, state } = req.body;
        const bcrypt = require('bcrypt');

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields required' });
        }

        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) return res.status(500).json({ error: 'Failed' });

            db.run(
                'INSERT INTO users (name, email, password, state, role) VALUES (?, ?, ?, ?, ?)',
                [name, email, hashedPassword, state || 'Nigeria', 'admin'],
                function(err) {
                    if (err) return res.status(500).json({ error: 'Email exists' });
                    res.status(201).json({ message: 'Admin created', id: this.lastID });
                }
            );
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

module.exports = {
    getPlatformStats,
    getPendingWithdrawals,
    approveWithdrawal,
    getAllSubmissions,
    getAllUsers,
    createAgent,
    createAdmin
};
