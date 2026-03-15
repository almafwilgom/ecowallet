const db = require('../db');

const getPlatformStats = (req, res) => {
    try {
        db.get(
            `SELECT
                (SELECT COUNT(*) FROM users WHERE role = 'user' AND deleted_at IS NULL) as total_users,
                (SELECT COUNT(*) FROM users WHERE role = 'agent' AND deleted_at IS NULL) as total_agents,
                (SELECT COUNT(*) FROM users WHERE role = 'admin' AND deleted_at IS NULL) as total_admins,
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
            `SELECT wr.*, u.name as user_name, u.email as user_email
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
        const { withdrawal_id, withdrawalId, status } = req.body;
        const targetId = withdrawal_id || withdrawalId;

        if (!targetId) {
            return res.status(400).json({ error: 'Withdrawal ID required' });
        }

        if (!status || !['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        db.get(
            'SELECT * FROM withdrawal_requests WHERE id = ?',
            [targetId],
            (err, withdrawal) => {
                if (err || !withdrawal) return res.status(500).json({ error: 'Failed' });

                db.run(
                    'UPDATE withdrawal_requests SET status = ? WHERE id = ?',
                    [status, targetId],
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

        let sql = `SELECT ws.*, u.name as user_name, a.name as agent_name
            FROM waste_submissions ws
            JOIN users u ON ws.user_id = u.id
            LEFT JOIN users a ON ws.agent_id = a.id
            ORDER BY ws.created_at DESC
            LIMIT 100`;
        let params = [];

        if (status) {
            sql = `SELECT ws.*, u.name as user_name, a.name as agent_name
                FROM waste_submissions ws
                JOIN users u ON ws.user_id = u.id
                LEFT JOIN users a ON ws.agent_id = a.id
                WHERE ws.status = ?
                ORDER BY ws.created_at DESC
                LIMIT 100`;
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

        let sql = 'SELECT id, name, email, state, role, deleted_at, created_at FROM users ORDER BY created_at DESC';
        let params = [];

        if (role) {
            sql = 'SELECT id, name, email, state, role, deleted_at, created_at FROM users WHERE role = ? ORDER BY created_at DESC';
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

const softDeleteUser = (req, res) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        const requesterId = req.user?.id;

        if (!targetId) {
            return res.status(400).json({ error: 'User ID required' });
        }
        if (requesterId && targetId === requesterId) {
            return res.status(400).json({ error: 'You cannot disable your own account' });
        }

        db.run(
            'UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
            [targetId],
            function(err) {
                if (err) return res.status(500).json({ error: 'Failed' });
                if (this.changes === 0) {
                    return res.status(404).json({ error: 'User not found or already disabled' });
                }
                return res.json({ message: 'User disabled successfully' });
            }
        );
    } catch (error) {
        return res.status(500).json({ error: 'Failed to disable user' });
    }
};

const restoreUser = (req, res) => {
    try {
        const targetId = parseInt(req.params.id, 10);

        if (!targetId) {
            return res.status(400).json({ error: 'User ID required' });
        }

        db.run(
            'UPDATE users SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL',
            [targetId],
            function(err) {
                if (err) return res.status(500).json({ error: 'Failed' });
                if (this.changes === 0) {
                    return res.status(404).json({ error: 'User not found or not disabled' });
                }
                return res.json({ message: 'User restored successfully' });
            }
        );
    } catch (error) {
        return res.status(500).json({ error: 'Failed to restore user' });
    }
};

const deleteUser = async (req, res) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        const requesterId = req.user?.id;

        if (!targetId) {
            return res.status(400).json({ error: 'User ID required' });
        }
        if (requesterId && targetId === requesterId) {
            return res.status(400).json({ error: 'You cannot delete your own account' });
        }

        await db.transaction(async (client) => {
            await client.query('UPDATE waste_submissions SET agent_id = NULL WHERE agent_id = $1', [targetId]);
            await client.query('DELETE FROM waste_submissions WHERE user_id = $1', [targetId]);
            await client.query('DELETE FROM withdrawal_requests WHERE user_id = $1', [targetId]);
            await client.query('DELETE FROM wallets WHERE user_id = $1', [targetId]);

            const result = await client.query('DELETE FROM users WHERE id = $1', [targetId]);
            if (result.rowCount === 0) {
                throw new Error('NOT_FOUND');
            }
        });

        return res.json({ message: 'User deleted successfully' });
    } catch (error) {
        if (error.message === 'NOT_FOUND') {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.status(500).json({ error: 'Failed to delete user' });
    }
};

module.exports = {
    getPlatformStats,
    getPendingWithdrawals,
    approveWithdrawal,
    getAllSubmissions,
    getAllUsers,
    createAgent,
    createAdmin,
    softDeleteUser,
    restoreUser,
    deleteUser
};
