const express = require('express');
const container = require('../container');

const router = express.Router();

const metadataController = container.getMetadataController();

/**
 * Get dataset metadata with caching
 * GET /getDatasetMetadata
 */
router.get('/getDatasetMetadata', metadataController.getDatasetMetadata.bind(metadataController));

/**
 * Health check for metadata functionality
 * GET /metadata/health
 */
router.get('/metadata/health', metadataController.healthCheck.bind(metadataController));

module.exports = router;