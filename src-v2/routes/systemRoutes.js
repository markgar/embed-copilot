const express = require('express');
const systemController = require('../controllers/systemController');

const router = express.Router();

/**
 * Health check endpoint
 * GET /health
 */
router.get('/health', systemController.healthCheck);

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

/**
 * Telemetry control endpoint
 * POST /telemetry-control
 */
router.post('/telemetry-control', systemController.telemetryControl);

module.exports = router;