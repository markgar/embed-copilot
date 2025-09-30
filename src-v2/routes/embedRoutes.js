const express = require('express');
const container = require('../container');

const router = express.Router();

const embedController = container.getEmbedController();

/**
 * Get embed token for Power BI report
 * GET /getEmbedToken
 */
router.get('/getEmbedToken', embedController.getEmbedToken.bind(embedController));

module.exports = router;