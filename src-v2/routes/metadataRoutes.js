const express = require('express');
const metadataController = require('../controllers/metadataController');

const router = express.Router();

/**
 * Get dataset metadata with caching
 * GET /getDatasetMetadata
 */
router.get('/getDatasetMetadata', metadataController.getDatasetMetadata);

/**
 * Health check for metadata functionality
 * GET /metadata/health
 */
router.get('/metadata/health', metadataController.healthCheck);

module.exports = router;