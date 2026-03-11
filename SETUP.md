# EcoWallet - Quick Start Guide

## 🚀 Get Running in 5 Minutes

### Prerequisites
- PostgreSQL installed
- Node.js installed (v14+)
- Text editor or IDE

### Step 1: Database Setup (2 min)

Open PostgreSQL (psql or GUI) and run:

```sql
CREATE DATABASE ecowallet;
\c ecowallet
-- Run all commands from schema.sql
```

### Step 2: Backend Setup (2 min)

```bash
cd backend
npm install
node server.js
```

Expected output:
```
✓ Database connected successfully
✓ Server running on port 3000
```

### Step 3: Frontend Setup (1 min)

From another terminal:
```bash
cd frontend
python -m http.server 5500
```

Or with Node:
```bash
npx http-server -p 5500
```

### Step 4: Access the Platform

Open browser and go to:
- 🌐 Frontend: `http://localhost:5500`
- 🔌 Backend: `http://localhost:3000`

## 🎯 Quick Test Flow

### 1. Register User
1. Click "Register" button
2. Fill in details:
   - Name: John Doe
   - Email: john@example.com
   - Password: password123
   - State: Lagos
3. Click "Register"

### 2. Login
1. Go to Login page
2. Enter credentials
3. Should redirect to dashboard

### 3. Submit Waste
1. In Dashboard, select material (e.g., "PET")
2. Enter weight (e.g., 2.5 kg)
3. Enter location
4. Click "Submit Waste"
5. See instant reward and CO₂ saved!

### 4. Check Leaderboard
- See your ranking based on total weight recycled
- View other users' contributions

### 5. Request Withdrawal
1. Scroll to "Request Withdrawal" section
2. Enter amount (₦500)
3. Select method (Airtime, Mobile Data, or Bank Transfer)
4. Click "Request Withdrawal"
5. Admin must approve (use admin dashboard)

## 👥 Role-Based Access

### User Dashboard
- Submit waste
- Track earnings
- View statistics
- See leaderboard
- Request withdrawals

### Agent Dashboard
1. Login with agent account (create via admin)
2. View pending waste submissions
3. Click "Mark Collected" to verify submissions
4. Track collection statistics

### Admin Dashboard
1. Login with admin account
2. View platform statistics
3. Approve/reject withdrawals
4. Create new agents and admins
5. Monitor all submissions

## 📊 Test Data Generation

To populate with test data, run these SQL queries in PostgreSQL:

```sql
-- Create test user
INSERT INTO users (name, email, password, state, role) 
VALUES ('Test User', 'test@example.com', 'hashedpassword', 'Lagos', 'user');

-- Create test submissions (adjust user_id as needed)
INSERT INTO waste_submissions 
(user_id, material_type, weight_kg, location, payout, co2_saved, status) 
VALUES (1, 'PET', 5, 'Lagos', 2250, 7.5, 'collected');
```

## 🔑 Environment Variables

Backend `.env` file should contain:

```env
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ecowallet
JWT_SECRET=secret123
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5500
```

## 🛠️ Common Issues & Solutions

### Port Already in Use
```bash
# Change PORT in backend/.env to 3001
# Or kill process on port 3000
# Windows: netstat -ano | findstr :3000
# Mac/Linux: lsof -i :3000 | grep LISTEN
```

### Database Connection Failed
```bash
# Check PostgreSQL is running
# Default password: postgres
# Update DB_PASSWORD in .env if different
```

### CORS Errors
```bash
# Backend needs FRONTEND_URL set correctly
# Restart backend after changing .env
# Frontend must be on same URL (http://localhost:5500)
```

### JavaScript Not Working
```bash
# Clear browser cache (Ctrl+Shift+Delete)
# Check browser console (F12)
# Verify backend is running (http://localhost:3000/health)
```

## 💡 Tips

1. **Always check browser console** (F12 > Console) for errors
2. **Backend must run first** before accessing dashboard
3. **Use incognito mode** if having login issues
4. **Database queries show in server logs** - helpful for debugging
5. **Chart.js library loads from CDN** - needs internet

## 📱 Material Prices Reference

| Material  | Price/kg | CO₂ Saved/kg |
|-----------|----------|-------------|
| PET       | ₦450     | 1.5 kg     |
| HDPE      | ₦420     | 1.8 kg     |
| Aluminum  | ₦1,200   | 9 kg       |
| Paper     | ₦150     | 0.8 kg     |

## 📈 What to Test

- ✓ User registration and login
- ✓ Waste submission and reward calculation
- ✓ Wallet balance updates
- ✓ Leaderboard sorting
- ✓ Agent collection workflow
- ✓ Admin withdrawal approval
- ✓ Role-based access control
- ✓ Charts and statistics
- ✓ Withdrawal requests
- ✓ Platform analytics

## 🎓 Learning Paths

### If you want to understand the code:

1. **Start with:** `api.js` - See how API calls work
2. **Then read:** `dashboard.js` - See data flow
3. **Check:** `server.js` - See backend structure
4. **Study:** `Controllers` - See business logic
5. **Review:** `schema.sql` - See database design

## 🚀 Next Steps

After running locally:
1. Deploy to cloud (Heroku, AWS, DigitalOcean)
2. Set up CI/CD pipeline
3. Add automated tests
4. Implement additional features
5. Scale database and API

---

**You're all set! Start recycling and earning rewards! 🌱💰**
