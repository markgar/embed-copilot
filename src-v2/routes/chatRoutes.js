const express = require('express');
const chatController = require('../controllers/chatController');

const router = express.Router();

/**
 * Chat endpoint for OpenAI interactions
 * POST /chat
 */
router.post('/chat', chatController.chat);

/**
 * Streaming chat endpoint (future enhancement)
 * POST /chat/stream
 */
// router.post('/chat/stream', chatController.chatStream);

module.exports = router;