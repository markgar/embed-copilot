const express = require('express');
const ChatController = require('../controllers/chatController');

const router = express.Router();

// Instantiate the controller
const chatController = new ChatController();

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