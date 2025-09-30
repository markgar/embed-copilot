const express = require('express');
const container = require('../container');

const router = express.Router();

// Get controller from container (with dependency injection)
const chatController = container.getChatController();

/**
 * Chat endpoint for OpenAI interactions
 * POST /chat
 */
router.post('/chat', (req, res) => chatController.chat(req, res));

/**
 * Streaming chat endpoint (future enhancement)
 * POST /chat/stream
 */
// router.post('/chat/stream', chatController.chatStream);

module.exports = router;