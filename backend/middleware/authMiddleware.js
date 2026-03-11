const jwt = require('jsonwebtoken');
const db = require('../db');

const authMiddleware = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        db.get(
            'SELECT id, role, deleted_at FROM users WHERE id = ?',
            [decoded.id],
            (err, user) => {
                if (err || !user) {
                    return res.status(401).json({ error: 'Invalid token' });
                }
                if (user.deleted_at) {
                    return res.status(403).json({ error: 'Account disabled' });
                }
                req.user = { ...decoded, role: user.role };
                next();
            }
        );
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

module.exports = authMiddleware;
