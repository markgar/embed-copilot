/**
 * Microsoft Fabric Routes
 * Handles routing for Fabric operations
 */

const express = require('express');
const fabricController = require('../controllers/fabricController');

const router = express.Router();

/**
 * POST /fabric/reports/ensure
 * Ensure a report exists - check if it exists, create if it doesn't
 * 
 * Body:
 * {
 *   "workspaceId": "uuid",
 *   "datasetId": "uuid", 
 *   "reportName": "string"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "reportId": "uuid",
 *     "workspaceId": "uuid",
 *     "displayName": "string",
 *     "existed": boolean,
 *     "message": "string"
 *   }
 * }
 */
router.post('/reports/ensure', fabricController.ensureReport);

module.exports = router;