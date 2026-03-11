-- EcoWallet Database Schema
-- PostgreSQL

-- Create extension for UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    state VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wallets table
CREATE TABLE wallets (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    balance DECIMAL(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Waste submissions table
CREATE TABLE waste_submissions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    material_type VARCHAR(100) NOT NULL,
    weight_kg DECIMAL(10, 3) NOT NULL,
    location VARCHAR(255),
    payout DECIMAL(15, 2) NOT NULL,
    co2_saved DECIMAL(10, 3) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    agent_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Withdrawal requests table
CREATE TABLE withdrawal_requests (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    method VARCHAR(50) NOT NULL,
    phone_number VARCHAR(20),
    bank_details JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_waste_submissions_user_id ON waste_submissions(user_id);
CREATE INDEX idx_waste_submissions_status ON waste_submissions(status);
CREATE INDEX idx_waste_submissions_created_at ON waste_submissions(created_at);
CREATE INDEX idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Create views for analytics
CREATE VIEW user_stats AS
SELECT 
    u.id,
    u.name,
    u.email,
    COUNT(ws.id) as total_submissions,
    COALESCE(SUM(ws.weight_kg), 0) as total_weight_kg,
    COALESCE(SUM(ws.co2_saved), 0) as total_co2_saved,
    COALESCE(w.balance, 0) as wallet_balance
FROM users u
LEFT JOIN waste_submissions ws ON u.id = ws.user_id
LEFT JOIN wallets w ON u.id = w.user_id
GROUP BY u.id, u.name, u.email, w.balance;

CREATE VIEW leaderboard AS
SELECT 
    u.id,
    u.name,
    COALESCE(SUM(ws.weight_kg), 0) as total_waste_kg,
    COALESCE(SUM(ws.co2_saved), 0) as total_co2_saved,
    ROW_NUMBER() OVER (ORDER BY SUM(ws.weight_kg) DESC) as rank
FROM users u
LEFT JOIN waste_submissions ws ON u.id = ws.user_id AND ws.status = 'collected'
WHERE u.role = 'user'
GROUP BY u.id, u.name
ORDER BY total_waste_kg DESC;

CREATE VIEW platform_stats AS
SELECT 
    (SELECT COUNT(*) FROM users WHERE role = 'user') as total_users,
    (SELECT COUNT(*) FROM users WHERE role = 'agent') as total_agents,
    (SELECT COUNT(*) FROM users WHERE role = 'admin') as total_admins,
    COALESCE((SELECT SUM(weight_kg) FROM waste_submissions WHERE status = 'collected'), 0) as total_waste_recycled_kg,
    COALESCE((SELECT SUM(co2_saved) FROM waste_submissions WHERE status = 'collected'), 0) as total_co2_saved_kg,
    COALESCE((SELECT SUM(payout) FROM waste_submissions WHERE status = 'collected'), 0) as total_payouts,
    COALESCE((SELECT COUNT(*) FROM waste_submissions WHERE status = 'pending'), 0) as pending_submissions;
