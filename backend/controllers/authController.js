const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

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

const register = (req, res) => {
    try {
        const { name, email, password, state } = req.body;

        // Validate input
        if (!name || !email || !password || !state) {
            return res.status(400).json({ error: 'All fields are required' });
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

                return res.status(200).json({
                    message: 'Login successful',
                    token,
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        state: user.state
                    }
                });
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Login failed' });
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
    getCurrentUser,
    MATERIAL_PRICES,
    CO2_CONVERSION
};
