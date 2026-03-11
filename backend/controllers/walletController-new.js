const db = require('../db');

const getBalance = (req, res) => {
    try {
        const user_id = req.user.id;

        db.get(
            'SELECT * FROM wallets WHERE user_id = ?',
            [user_id],
            (err, wallet) => {
                if (err) return res.status(500).json({ error: 'Failed' });
                res.json({ wallet: wallet || { balance: 0 } });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

const requestWithdrawal = (req, res) => {
    try {
        const user_id = req.user.id;
        const { amount, method, phone_number, bank_account } = req.body;

        if (!amount || !method) {
            return res.status(400).json({ error: 'Amount and method required' });
        }

        db.get(
            'SELECT balance FROM wallets WHERE user_id = ?',
            [user_id],
            (err, wallet) => {
                if (err || !wallet) return res.status(500).json({ error: 'Failed' });
                if (wallet.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

                const bankDetails = bank_account ? JSON.stringify({ account: bank_account }) : null;

                db.run(
                    'INSERT INTO withdrawal_requests (user_id, amount, method, phone_number, bank_details, status) VALUES (?, ?, ?, ?, ?, ?)',
                    [user_id, amount, method, phone_number || null, bankDetails, 'pending'],
                    function(err) {
                        if (err) return res.status(500).json({ error: 'Failed' });
                        res.status(201).json({
                            message: 'Withdrawal requested',
                            withdrawal: { id: this.lastID, amount, method, status: 'pending' }
                        });
                    }
                );
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

const getWithdrawals = (req, res) => {
    try {
        const user_id = req.user.id;
        const { status } = req.query;

        let sql = 'SELECT * FROM withdrawal_requests WHERE user_id = ? ORDER BY created_at DESC';
        let params = [user_id];

        if (status) {
            sql = 'SELECT * FROM withdrawal_requests WHERE user_id = ? AND status = ? ORDER BY created_at DESC';
            params = [user_id, status];
        }

        db.all(sql, params, (err, rows) => {
            if (err) return res.status(500).json({ error: 'Failed' });
            res.json({ withdrawals: rows || [] });
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

module.exports = {
    getBalance,
    requestWithdrawal,
    getWithdrawals
};
