const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get(
    '/submissions/pending',
    authMiddleware,
    roleMiddleware(['agent']),
    agentController.getPendingSubmissions
);

router.post(
    '/collect',
    authMiddleware,
    roleMiddleware(['agent']),
    agentController.collectSubmission
);

router.get(
    '/submissions/collected',
    authMiddleware,
    roleMiddleware(['agent']),
    agentController.getCollectedSubmissions
);

router.get(
    '/stats',
    authMiddleware,
    roleMiddleware(['agent']),
    agentController.getAgentStats
);

module.exports = router;
