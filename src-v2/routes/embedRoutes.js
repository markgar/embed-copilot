const express = require('express');
const embedController = require('../controllers/embedController');

const router = express.Router();

/**
 * Get embed token for Power BI report
 * GET /getEmbedToken
 */
router.get('/getEmbedToken', embedController.getEmbedToken);

module.exports = router;