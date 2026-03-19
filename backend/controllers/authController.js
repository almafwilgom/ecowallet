const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db');

let OAuth2Client;
let nodemailer;

try {
    ({ OAuth2Client } = require('google-auth-library'));
} catch (err) {
    OAuth2Client = null;
}

try {
    nodemailer = require('nodemailer');
} catch (err) {
    nodemailer = null;
}

// Material prices in NGN per kg
const MATERIAL_PRICES = {
    'PET': 450,
    'HDPE': 420,
    'Aluminum': 1200,
    'Paper': 150
};

// CO2 conversion rates in kg CO2 per kg material
const CO2_CONVERSION = {
    'PET': 1.5,
    'HDPE': 1.8,
    'Aluminum': 9,
    'Paper': 0.8
};

const PASSWORD_RESET_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || 60);
const DEFAULT_RESET_BASE_URL = process.env.FRONTEND_URL || 'http://localhost:5500';

const googleClientIds = () => {
    const raw = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_IDS;
    if (!raw) return [];
    return raw.split(',').map((id) => id.trim()).filter(Boolean);
};

const getGoogleClient = (() => {
    let client = null;
    return () => {
        if (!OAuth2Client) return null;
        if (!client) {
            const ids = googleClientIds();
            client = new OAuth2Client(ids[0]);
        }
        return client;
    };
})();

function buildAuthResponse(user) {
    const token = jwt.sign(
        {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );

    return {
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            state: user.state
        }
    };
}

async function sendPasswordResetEmail(email, resetLink) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user || 'no-reply@ecowallet.local';

    if (!host || !nodemailer) {
        console.log(`Password reset link for ${email}: ${resetLink}`);
        return { sent: false };
    }

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE === 'true',
        auth: user && pass ? { user, pass } : undefined
    });

    await transporter.sendMail({
        from,
        to: email,
        subject: 'Reset your EcoWallet password',
        text: `Reset your password using this link: ${resetLink}`,
        html: `
            <p>You requested a password reset for EcoWallet.</p>
            <p><a href="${resetLink}">Click here to reset your password</a></p>
            <p>This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes.</p>
        `.trim()
    });

    return { sent: true };
}

const register = (req, res) => {
    try {
        const { name, email, password, state } = req.body;

        // Validate input
        if (!name || !email || !password || !state) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || typeof state !== 'string') {
            return res.status(400).json({ error: 'Invalid data format: fields must be strings' });
        }

        // Check if user already exists
        db.get('SELECT id, deleted_at FROM users WHERE email = ?', [email], (err, userExists) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (userExists) {
                if (userExists.deleted_at) {
                    return res.status(409).json({ error: 'Account is disabled. Contact admin.' });
                }
                return res.status(409).json({ error: 'User already exists' });
            }

            // Hash password
            bcrypt.hash(password, 10, (err, hashedPassword) => {
                if (err) {
                    return res.status(500).json({ error: 'Registration failed' });
                }

                // Create user
                db.run(
                    'INSERT INTO users (name, email, password, state, role) VALUES (?, ?, ?, ?, ?)',
                    [name, email, hashedPassword, state, 'user'],
                    function(err) {
                        if (err) {
                            return res.status(500).json({ error: 'Registration failed' });
                        }

                        const userId = this.lastID;

                        // Create wallet for user
                        db.run(
                            'INSERT INTO wallets (user_id, balance) VALUES (?, ?)',
                            [userId, 0],
                            (err) => {
                                if (err) {
                                    return res.status(500).json({ error: 'Wallet creation failed' });
                                }

                                return res.status(201).json({
                                    message: 'User registered successfully',
                                    user: {
                                        id: userId,
                                        name,
                                        email,
                                        role: 'user'
                                    }
                                });
                            }
                        );
                    }
                );
            });
        });
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ error: 'Registration failed' });
    }
};

const login = (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (typeof email !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ error: 'Invalid data format: email and password must be strings' });
        }

        // Find user
        db.get('SELECT id, name, email, password, role, state FROM users WHERE email = ? AND deleted_at IS NULL', [email], (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Login failed' });
            }

            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Compare passwords
            bcrypt.compare(password, user.password, (err, passwordMatch) => {
                if (err || !passwordMatch) {
                    return res.status(401).json({ error: 'Invalid credentials' });
                }

                // Generate JWT token
                return res.status(200).json({
                    message: 'Login successful',
                    ...buildAuthResponse(user)
                });
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Login failed' });
    }
};

const googleLogin = async (req, res) => {
    try {
        const { credential } = req.body || {};

        if (!credential) {
            return res.status(400).json({ error: 'Google credential is required' });
        }

        const clientIds = googleClientIds();
        const client = getGoogleClient();

        if (!client || clientIds.length === 0) {
            return res.status(503).json({ error: 'Google login is not configured' });
        }

        let payload;
        try {
            const ticket = await client.verifyIdToken({
                idToken: credential,
                audience: clientIds
            });
            payload = ticket.getPayload();
        } catch (err) {
            return res.status(401).json({ error: 'Invalid Google token' });
        }

        if (!payload?.email || !payload?.email_verified) {
            return res.status(401).json({ error: 'Google account email is not verified' });
        }

        const email = payload.email.toLowerCase();
        const googleId = payload.sub;
        const displayName = payload.name || payload.given_name || email.split('@')[0];

        db.get(
            'SELECT id, name, email, role, state, google_id, deleted_at FROM users WHERE email = ?',
            [email],
            (err, user) => {
                if (err) {
                    return res.status(500).json({ error: 'Login failed' });
                }

                if (user) {
                    if (user.deleted_at) {
                        return res.status(403).json({ error: 'Account is disabled' });
                    }

                    if (user.google_id && user.google_id !== googleId) {
                        return res.status(401).json({ error: 'Google account mismatch' });
                    }

                    if (!user.google_id) {
                        db.run(
                            'UPDATE users SET google_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                            [googleId, user.id],
                            (updateErr) => {
                                if (updateErr) {
                                    return res.status(500).json({ error: 'Login failed' });
                                }
                                return res.status(200).json({
                                    message: 'Login successful',
                                    ...buildAuthResponse(user)
                                });
                            }
                        );
                        return;
                    }

                    return res.status(200).json({
                        message: 'Login successful',
                        ...buildAuthResponse(user)
                    });
                }

                const randomPassword = crypto.randomBytes(32).toString('hex');
                const state = 'Unknown';

                bcrypt.hash(randomPassword, 10, (hashErr, hashedPassword) => {
                    if (hashErr) {
                        return res.status(500).json({ error: 'Login failed' });
                    }

                    db.run(
                        'INSERT INTO users (name, email, password, state, role, google_id) VALUES (?, ?, ?, ?, ?, ?)',
                        [displayName, email, hashedPassword, state, 'user', googleId],
                        function(insertErr) {
                            if (insertErr) {
                                return res.status(500).json({ error: 'Login failed' });
                            }

                            const userId = this.lastID;
                            db.run(
                                'INSERT INTO wallets (user_id, balance) VALUES (?, ?)',
                                [userId, 0],
                                (walletErr) => {
                                    if (walletErr) {
                                        return res.status(500).json({ error: 'Login failed' });
                                    }

                                    return res.status(200).json({
                                        message: 'Login successful',
                                        ...buildAuthResponse({
                                            id: userId,
                                            name: displayName,
                                            email,
                                            role: 'user',
                                            state
                                        })
                                    });
                                }
                            );
                        }
                    );
                });
            }
        );
    } catch (error) {
        console.error('Google login error:', error);
        return res.status(500).json({ error: 'Login failed' });
    }
};

const requestPasswordReset = (req, res) => {
    try {
        const { email } = req.body || {};

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        db.get(
            'SELECT id, email, deleted_at FROM users WHERE email = ?',
            [email],
            async (err, user) => {
                if (err) {
                    return res.status(500).json({ error: 'Password reset failed' });
                }

                if (!user || user.deleted_at) {
                    return res.status(200).json({
                        message: 'If the account exists, a reset link has been sent.'
                    });
                }

                const rawToken = crypto.randomBytes(32).toString('hex');
                const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
                const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000).toISOString();
                const resetBase = process.env.PASSWORD_RESET_URL || DEFAULT_RESET_BASE_URL;
                const resetLink = `${resetBase.replace(/\/$/, '')}/reset-password.html?token=${rawToken}`;

                db.run('DELETE FROM password_resets WHERE user_id = ?', [user.id], (cleanupErr) => {
                    if (cleanupErr) {
                        return res.status(500).json({ error: 'Password reset failed' });
                    }

                    db.run(
                        'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
                        [user.id, tokenHash, expiresAt],
                        async (insertErr) => {
                            if (insertErr) {
                                return res.status(500).json({ error: 'Password reset failed' });
                            }

                            try {
                                await sendPasswordResetEmail(user.email, resetLink);
                            } catch (sendErr) {
                                console.error('Password reset email error:', sendErr);
                            }

                            return res.status(200).json({
                                message: 'If the account exists, a reset link has been sent.'
                            });
                        }
                    );
                });
            }
        );
    } catch (error) {
        console.error('Password reset request error:', error);
        return res.status(500).json({ error: 'Password reset failed' });
    }
};

const confirmPasswordReset = (req, res) => {
    try {
        const { token, password } = req.body || {};

        if (!token || !password) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        db.get(
            'SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?',
            [tokenHash],
            (err, resetRow) => {
                if (err || !resetRow) {
                    return res.status(400).json({ error: 'Invalid or expired reset token' });
                }

                if (resetRow.used_at) {
                    return res.status(400).json({ error: 'Reset token has already been used' });
                }

                const expiry = new Date(resetRow.expires_at);
                if (Number.isNaN(expiry.getTime()) || expiry.getTime() < Date.now()) {
                    return res.status(400).json({ error: 'Reset token has expired' });
                }

                bcrypt.hash(password, 10, (hashErr, hashedPassword) => {
                    if (hashErr) {
                        return res.status(500).json({ error: 'Password reset failed' });
                    }

                    db.run(
                        'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [hashedPassword, resetRow.user_id],
                        (updateErr) => {
                            if (updateErr) {
                                return res.status(500).json({ error: 'Password reset failed' });
                            }

                            db.run(
                                'UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = ?',
                                [resetRow.id],
                                (markErr) => {
                                    if (markErr) {
                                        return res.status(500).json({ error: 'Password reset failed' });
                                    }

                                    return res.status(200).json({ message: 'Password reset successful' });
                                }
                            );
                        }
                    );
                });
            }
        );
    } catch (error) {
        console.error('Password reset confirm error:', error);
        return res.status(500).json({ error: 'Password reset failed' });
    }
};

const getCurrentUser = (req, res) => {
    try {
        const userId = req.user.id;

        db.get('SELECT id, name, email, role, state FROM users WHERE id = ? AND deleted_at IS NULL', [userId], (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch user' });
            }

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            return res.status(200).json({ user });
        });
    } catch (error) {
        console.error('Get user error:', error);
        return res.status(500).json({ error: 'Failed to fetch user' });
    }
};

module.exports = {
    register,
    login,
    googleLogin,
    requestPasswordReset,
    confirmPasswordReset,
    getCurrentUser,
    MATERIAL_PRICES,
    CO2_CONVERSION
};
