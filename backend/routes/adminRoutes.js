const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get(
    '/stats',
    authMiddleware,
    roleMiddleware(['admin']),
    adminController.getPlatformStats
);

router.get(
    '/users',
    authMiddleware,
    roleMiddleware(['admin']),
    adminController.getAllUsers
);

router.get(
    '/submissions',
    authMiddleware,
    roleMiddleware(['admin']),
    adminController.getAllSubmissions
);

router.get(
    '/withdrawals/pending',
    authMiddleware,
    roleMiddleware(['admin']),
    adminController.getPendingWithdrawals
);

router.post(
    '/approve-withdrawal',
    authMiddleware,
    roleMiddleware(['admin']),
    adminController.approveWithdrawal
);

router.post(
    '/create-admin',
    authMiddleware,
    roleMiddleware(['admin']),
    adminController.createAdmin
);

router.post(
    '/create-agent',
    authMiddleware,
    roleMiddleware(['admin']),
    adminController.createAgent
);

router.delete(
    '/users/:id',
    authMiddleware,
    roleMiddleware(['admin']),
    adminController.deleteUser
);

router.patch(
    '/users/:id/soft-delete',
    authMiddleware,
    roleMiddleware(['admin']),
    adminController.softDeleteUser
);

router.patch(
    '/users/:id/restore',
    authMiddleware,
    roleMiddleware(['admin']),
    adminController.restoreUser
);

module.exports = router;
