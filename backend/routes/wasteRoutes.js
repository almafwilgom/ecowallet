const express = require('express');
const router = express.Router();
const wasteController = require('../controllers/wasteController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/submit', authMiddleware, wasteController.submitWaste);
router.get('/submissions', authMiddleware, wasteController.getUserSubmissions);
router.get('/leaderboard', wasteController.getLeaderboard);
router.get('/user-stats', authMiddleware, wasteController.getUserStats);

module.exports = router;
