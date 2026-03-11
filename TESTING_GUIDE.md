# 🌱 EcoWallet - Quick Start Testing Guide

## ✅ Current Status
- Backend Server: **Running on Port 3002** ✓
- Frontend Server: **Running on Port 8080** ✓
- Database: **SQLite - Initialized** ✓

## 🚀 Step-by-Step Testing

### 1. Open the Application
Go to: **http://localhost:8080**

You should see the EcoWallet landing page with:
- Green navigation bar with EcoWallet logo
- Hero section: "Turn Your Waste Into Rewards"
- Features, How It Works, and Impact sections

### 2. Test Registration
1. Click **"Get Started"** or **"Register"** button
2. Fill in the form:
   - **Full Name**: Enter any name (e.g., "John Doe")
   - **Email Address**: Use a unique email (e.g., "john@example.com")
   - **Password**: Any password 6+ characters (e.g., "Password123")
   - **State/Region**: Enter your state (e.g., "Lagos")
3. Click **"Register"**
4. Expected Result: "User registered successfully" message
5. Should redirect to login page

### 3. Test Login
1. Use the credentials you just created to login
2. Fill in:
   - **Email**: The email from registration
   - **Password**: The password you set
3. Click **"Login"**
4. Expected Result: Redirect to **Dashboard** page
5. Dashboard shows:
   - User's name and wallet balance
   - Quick stats
   - Navigation to submit waste and view leaderboard

### 4. Test Waste Submission (Dashboard)
1. On Dashboard, fill in waste submission form:
   - **Material Type**: Select from dropdown (PET, HDPE, Aluminum, Paper)
   - **Weight (kg)**: Enter amount (e.g., 5)
   - **Location**: Enter location (e.g., "Lagos, Nigeria")
2. Click **"Submit Waste"**
3. Expected Result:
   - Submission appears in "My Submissions" table
   - Wallet balance increases
   - Status shows "Pending" (waiting for agent collection)

### 5. Test View Leaderboard
1. Click **"Leaderboard"** in navigation
2. See top waste recyclers ranked by:
   - Total waste recycled (kg)
   - CO₂ saved (kg)
   - Total earnings (₦)

### 6. Test Withdrawal (Optional - User Role)
1. From Dashboard, click **"Request Withdrawal"**
2. Enter:
   - **Amount**: Amount to withdraw (must be ≤ balance)
   - **Method**: Select "Airtime", "Mobile Data", or "Bank Transfer"
   - **Phone/Bank Details**: Enter appropriate details
3. Click **"Submit"**
4. Expected Result: Withdrawal request created (status: Pending)

### 7. Test Admin Dashboard (Special User)
To test admin features, you need an admin account. For testing:
1. Run this curl command to create admin user:
```bash
curl -X POST http://localhost:3002/admin/create-admin \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@example.com",
    "password": "AdminPass123",
    "state": "Lagos"
  }'
```

2. Login with admin credentials
3. Admin Dashboard shows:
   - Platform Stats: Total users, waste recycled, CO₂ saved, payouts
   - Pending Withdrawals: List of withdrawal requests
   - Approve/Reject buttons for each request
   - Manage Users: Create new agents/admins
   - View all submissions

### 8. Test Agent Dashboard (Special User)
To test agent features:
1. Create agent user:
```bash
curl -X POST http://localhost:3002/admin/create-agent \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Agent User",
    "email": "agent@example.com",
    "password": "AgentPass123",
    "state": "Lagos"
  }'
```

2. Login with agent credentials
3. Agent Dashboard shows:
   - Pending waste submissions to collect
   - Click "Collect" to mark submission as collected
   - View collected submissions
   - Agent stats: Total collected, CO₂ saved, commission earned

## 📋 Verification Checklist

- [ ] Registration works (user created with wallet)
- [ ] Login works (JWT token received)
- [ ] Dashboard/Home loads after login
- [ ] Waste submission creates record and updates wallet
- [ ] Leaderboard displays users with waste totals
- [ ] Admin can approve/reject withdrawals
- [ ] Agent can collect waste submissions
- [ ] Navigation works on mobile (hamburger menu)
- [ ] Fixed header stays visible when scrolling
- [ ] All pages are responsive

## 🔍 Testing via curl/API

### Register a User
```bash
curl -X POST http://localhost:3002/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "Test123",
    "state": "Lagos"
  }'
```

Response:
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "name": "Test User",
    "email": "test@example.com",
    "role": "user"
  }
}
```

### Login
```bash
curl -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123"
  }'
```

Response:
```json
{
  "message": "Login successful",
  "token": "<JWT_TOKEN>",
  "user": {
    "id": 1,
    "name": "Test User",
    "email": "test@example.com",
    "role": "user",
    "state": "Lagos"
  }
}
```

### Submit Waste (use token from login)
```bash
curl -X POST http://localhost:3002/waste/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "material_type": "PET",
    "weight_kg": 5,
    "location": "Lagos, Nigeria"
  }'
```

### Get Platform Stats
```bash
curl http://localhost:3002/admin/stats
```

## 🎯 Expected Results Summary

| Feature | Status | Expected |
|---------|--------|----------|
| Registration | ✓ Working | User created with wallet |
| Login | ✓ Working | JWT token received |
| Waste Submission | ✓ Working | Balance updates |
| Wallet Balance | ✓ Working | Shows earned amount |
| Leaderboard | ✓ Working | Users ranked by waste |
| Admin Stats | ✓ Working | Platform statistics shown |
| Agent Collection | ✓ Working | Mark submissions collected |
| Withdrawal Requests | ✓ Working | Admin can approve/reject |

## 🚨 Troubleshooting

### "NetworkError when attempting to fetch resource"
- **Check**: Backend is running (`netstat -ano | grep 3002`)
- **Check**: Frontend URL is http://localhost:8080
- **Fix**: Refresh the page (Ctrl+F5 to clear cache)
- **Fix**: Check browser console (F12) for CORS errors
- **Fix**: Verify API_BASE_URL in frontend/js/api.js is http://localhost:3002

### "User already exists"  
- **Cause**: Email already registered
- **Fix**: Use a different email address

### "Invalid credentials"
- **Cause**: Wrong email or password
- **Fix**: Check email and password are correct

### Server not starting
- **Fix**: Check if port 3002 is in use: `netstat -ano | grep 3002`
- **Fix**: Kill process: `netstat -ano | grep 3002 | awk '{print $NF}' | xargs kill -9`

## 📞 Database

- **Type**: SQLite (file-based)
- **Location**: `c:\Users\ADMIN\Desktop\ecowallet\ecowallet.db`
- **Tables**: 4 (users, wallets, waste_submissions, withdrawal_requests)
- **Status**: Auto-initialized on server startup

## 🎉 Success Indicators

You know the system is working when you can:
1. ✓ Register a new account
2. ✓ Login with the registered account
3. ✓ See dashboard with balance
4. ✓ Submit waste and see balance increase
5. ✓ View waste on leaderboard
6. ✓ Request withdrawal
7. ✓ Admin approves withdrawal
8. ✓ Navigation works smoothly
9. ✓ Mobile menu (hamburger) works
10. ✓ No console errors in browser

---

**Last Updated**: March 11, 2026  
**Application Status**: Ready for Testing  
**Backend**: Node.js + Express + SQLite  
**Frontend**: HTML5 + CSS3 + Vanilla JavaScript  
