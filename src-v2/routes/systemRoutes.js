const express = require('express');
const systemController = require('../controllers/systemController');

const router = express.Router();

/**
 * Health check endpoint
 * GET /health
 */
router.get('/health', systemController.healthCheck);

/**
 * Detailed status endpoint
 * GET /status
 */
router.get('/status', systemController.detailedHealthCheck);

/**
 * Client error logging
 * POST /log-error
 */
router.post('/log-error', systemController.logError);

/**
 * Client console logging
 * POST /log-console
 */
router.post('/log-console', systemController.logConsole);

module.exports = router;