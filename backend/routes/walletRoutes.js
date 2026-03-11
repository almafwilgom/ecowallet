const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/balance', authMiddleware, walletController.getBalance);
router.post('/withdraw', authMiddleware, walletController.requestWithdrawal);
router.get('/withdrawals', authMiddleware, walletController.getWithdrawals);

module.exports = router;
