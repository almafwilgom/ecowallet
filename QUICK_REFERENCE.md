# 🌱 EcoWallet - Quick Reference Card

## 🚀 Quick Start (Copy & Paste)

### Terminal 1: Database Setup
```bash
psql -U postgres
CREATE DATABASE ecowallet;
\c ecowallet
\i schema.sql
\q
```

### Terminal 2: Backend
```bash
cd backend
npm install
node server.js
```

### Terminal 3: Frontend
```bash
cd frontend
python -m http.server 5500
```

### Browser
```
http://localhost:5500
```

---

## 🔗 URLs to Remember

| Service | URL | Status |
|---------|-----|--------|
| Frontend | http://localhost:5500 | Open in browser |
| Backend API | http://localhost:3000 | JSON responses |
| Health Check | http://localhost:3000/health | {"status":"OK"} |
| PostgreSQL | localhost:5432 | Database |

---

## 📝 Test Account Setup

### Step 1: Register
```
Visit: http://localhost:5500/register
Name: Test User
Email: test@example.com
Password: password123
State: Lagos
```

### Step 2: Login
```
Email: test@example.com
Password: password123
```

### Step 3: Submit Waste (in Dashboard)
```
Material: PET (or any)
Weight: 2.5 kg
Location: Your location
→ Instant Reward: ₦1,125
→ CO₂ Saved: 3.75 kg
```

---

## 💰 Reward Formula Reference

### PET Plastic
- Price: **₦450/kg**
- CO₂ Saved: **1.5 kg/kg**
- Example: 2kg = ₦900 + 3kg CO₂

### HDPE Plastic
- Price: **₦420/kg**
- CO₂ Saved: **1.8 kg/kg**

### Aluminum
- Price: **₦1,200/kg**
- CO₂ Saved: **9 kg/kg**

### Paper
- Price: **₦150/kg**
- CO₂ Saved: **0.8 kg/kg**

---

## 🔐 User Roles & Access

### 👤 User
- ✅ Register, Login
- ✅ Submit waste
- ✅ View dashboard
- ✅ Check wallet
- ✅ See leaderboard
- ✅ Request withdrawal

### 🚚 Agent
- ✅ View pending submissions
- ✅ Mark items as collected
- ✅ Track collections
- ✅ View stats

### 👨‍💼 Admin
- ✅ View all users
- ✅ View all submissions
- ✅ Approve withdrawals
- ✅ Create agents
- ✅ Create admins
- ✅ Monitor stats

---

## 🗄️ Database Tables

```
users (id, name, email, password, state, role)
↓
wallets (id, user_id, balance)
↓
waste_submissions (id, user_id, material, weight, payout, co2_saved, status)
↓
withdrawal_requests (id, user_id, amount, method, status)
```

---

## 🔌 API Endpoints (Quick Ref)

### Auth
- `POST /auth/register` - Create account
- `POST /auth/login` - Get token
- `GET /auth/me` - Current user

### Waste
- `POST /waste/submit` - Submit waste
- `GET /waste/user-stats` - Your stats
- `GET /waste/leaderboard` - Top 10

### Wallet
- `GET /wallet/balance` - Check balance
- `POST /wallet/withdraw` - Request withdrawal

### Agent
- `GET /agent/submissions/pending` - Pending items
- `POST /agent/collect` - Mark collected

### Admin
- `GET /admin/stats` - Platform stats
- `POST /admin/approve-withdrawal` - Approve request

---

## 🐛 Troubleshooting Quick Fixes

| Problem | Fix |
|---------|-----|
| Port 3000 in use | Change PORT in .env to 3001 |
| DB connection fail | Check PostgreSQL running: `psql` |
| Can't login | Clear browser cache (Ctrl+Shift+Delete) |
| Charts not showing | Refresh page (Ctrl+F5) hard refresh |
| "Cannot reach API" | Verify backend running: `curl localhost:3000/health` |

---

## 📂 Important Files

```
backend/
  .env ........................ Configuration (edit DB password here)
  server.js ................... Main server file
  package.json ............... Dependencies
  
frontend/
  index.html .................. Landing page
  login.html .................. Login
  register.html ............... Registration
  dashboard.html .............. User dashboard
  admin.html .................. Admin dashboard
  agent.html .................. Agent dashboard
  css/styles.css .............. All styling
  js/api.js ................... API integration
  js/dashboard.js ............. Dashboard logic

schema.sql .................... Database setup
```

---

## ✅ Feature Checklist

### User Features
- [ ] Register with email
- [ ] Login with JWT
- [ ] View wallet balance
- [ ] Submit waste
- [ ] Get instant rewards
- [ ] Track CO₂ savings
- [ ] See leaderboard
- [ ] Request withdrawal

### Agent Features
- [ ] See pending items
- [ ] Mark as collected
- [ ] Track collections
- [ ] View stats

### Admin Features
- [ ] View platform stats
- [ ] Manage users
- [ ] Approve withdrawals
- [ ] Create agents/admins

---

## 🎯 Common Tasks

### Create Test Data
```bash
# Login as admin, then:
1. Go to Admin Dashboard
2. Click "Manage" tab
3. Fill "Create Agent Account" form
4. Submit
→ Agent account created with email/password
```

### Approve Withdrawal
```bash
# As admin:
1. Dashboard → Withdrawals tab
2. Find pending request
3. Click "Approve" or "Reject"
4. Status updates immediately
```

### Check Database
```bash
psql -U postgres -d ecowallet
SELECT * FROM users;
SELECT * FROM wallets;
SELECT * FROM waste_submissions;
\q
```

---

## 📊 Key Statistics Locations

### User Dashboard
- Wallet Balance (top metric)
- Total Waste Recycled (kg)
- Total CO₂ Saved (kg)
- Activity history table
- Leaderboard
- Charts

### Agent Dashboard
- Total Collections (metric)
- Total Weight Collected (kg)
- CO₂ Prevented (kg)
- Pending items table
- Collection history

### Admin Dashboard
- Total Users (metric)
- Total Waste (kg)
- Total CO₂ (kg)
- Total Payouts (₦)
- Pending Withdrawals count

---

## 🔑 Environment Variables (.env)

```
DB_USER=postgres           [Database username]
DB_PASSWORD=postgres       [Database password]
DB_HOST=localhost          [Database host]
DB_PORT=5432              [Database port]
DB_NAME=ecowallet         [Database name]
JWT_SECRET=secret123      [JWT signing key]
PORT=3000                 [Backend port]
NODE_ENV=development      [Environment mode]
FRONTEND_URL=http://localhost:5500  [Frontend URL]
```

---

## 🚀 Performance Tips

- Use `.env` for configuration (no hardcoding)
- Database backup regularly
- Monitor backend logs for errors
- Clear browser cache if UI issues
- Restart backend if database connection fails
- Use incognito window for clean test

---

## 📚 Documentation Map

| Document | Purpose |
|----------|---------|
| GETTING_STARTED.md | This complete setup guide |
| README.md | Full documentation |
| SETUP.md | Quick start (2 pages) |
| IMPLEMENTATION_SUMMARY.md | What was built |
| FILE_STRUCTURE.md | File organization |

---

## 🎓 Code First-Look

### To understand authentication:
**File:** `backend/controllers/authController.js`
**Key functions:** `register()`, `login()`

### To understand waste:
**File:** `backend/controllers/wasteController.js`
**Key functions:** `submitWaste()`, `getLeaderboard()`

### To understand api calls:
**File:** `frontend/js/api.js`
**Key objects:** `authAPI`, `wasteAPI`, `walletAPI`

### To understand dashboard:
**File:** `frontend/js/dashboard.js`
**Key functions:** `handleWasteSubmission()`, `loadCharts()`

---

## 🆘 Getting Help

### Check These First:
1. Browser Console - `F12 > Console tab`
2. Backend Terminal - Look for error messages
3. Database - Run queries to check data
4. Documentation - Search README.md
5. Code Comments - Read inline explanations

### Common Error Solutions:
- **"Token invalid"** → Login again
- **"Cannot reach API"** → Check backend running
- **"Database error"** → Verify PostgreSQL started
- **"Port in use"** → Kill process or change port
- **"CORS error"** → Check FRONTEND_URL in .env

---

## 🎯 Success Indicators

✅ Backend shows: `✓ Server running on port 3000`
✅ Frontend shows: EcoWallet landing page loads
✅ Can register new user
✅ Can login successfully
✅ Dashboard loads with metrics
✅ Can submit waste and see reward
✅ Wallet balance increases
✅ Appear on leaderboard
✅ Can request withdrawal

---

## 🌍 This Platform Supports:

- ♻️ Recycling incentives in Nigeria
- 💰 NGN currency
- 📱 Mobile responsive
- 💚 Eco-friendly green theme
- 🔐 Secure authentication
- 📊 Real-time analytics
- 👥 Multi-user system
- 🚀 Production scalability

---

## 💡 Pro Tips

1. **Incognito Mode** - Use for clean testing (no cached auth)
2. **DevTools** - Press F12 to debug issues
3. **Nodemon** - Use `nodemon server.js` for hot-reload during development
4. **SQL** - Query database directly for troubleshooting
5. **Logs** - Check backend terminal for detailed error messages

---

## 📈 Scaling Considerations

### To handle more users:
- Add read replicas for database
- Implement caching (Redis)
- Use load balancing (NGINX)
- Scale backend horizontally (multiple instances)
- Use CDN for frontend static files

### To add features:
- New controllers follow same pattern
- New routes in routes/ folder
- New HTML pages in frontend/
- Add SQL migrations for database changes

---

## 🎉 Ready to Go!

You have everything needed:
- ✅ Complete backend (Node.js + Express)
- ✅ Complete frontend (HTML+CSS+JS)
- ✅ Complete database (PostgreSQL)
- ✅ Documentation (this guide + more)
- ✅ Test workflow (step-by-step guide)

**Start now with the Quick Start section at the top!**

---

*Last Updated: 2026*
*EcoWallet MVP - Complete & Production Ready*
*Questions? Check GETTING_STARTED.md or README.md*
