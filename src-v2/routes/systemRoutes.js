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
 * Get logs endpoint
 * GET /logs
 */
router.get('/logs', systemController.getTelemetryLogs);

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