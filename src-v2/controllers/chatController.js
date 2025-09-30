const OpenAIService = require('../services/openaiService');
const PowerBIService = require('../services/powerbiService');
const configService = require('../services/configService');
const errorService = require('../services/errorService');

/**
 * Chat Controller - Handles AI chat functionality
 * Thin wrapper around OpenAI service with metadata integration
 */
class ChatController {
  constructor(openaiService = null) {
    this.openaiService = openaiService || new OpenAIService();
  }
  /**
     * Process chat message with AI
     * POST /chat
     * Body: { message, conversation? }
     */
  async chat(req, res) {
    console.log('[ChatController] Chat request received:', req.body);
    try {
      // Validate request - extract all expected parameters from original implementation
      const { message, currentChart, chatHistory } = req.body || {};
      console.log('[ChatController] Extracted message:', message);
      console.log('[ChatController] Extracted currentChart:', currentChart);
      console.log('[ChatController] Extracted chatHistory:', chatHistory);
            
      if (!message || message.trim() === '') {
        console.log('[ChatController] Message validation failed');
        return errorService.sendError(res, 400, 'Message is required');
      }

      console.log('[ChatController] Loading configuration...');
      // Load configuration
      const config = configService.loadConfig();
      console.log('[ChatController] Configuration loaded successfully');
      console.log('[ChatController] Configuration loaded successfully');
            
      // Check OpenAI configuration
      if (!config.openaiApiKey && !config.azureOpenAIApiKey) {
        console.log('[ChatController] OpenAI configuration missing');
        return errorService.sendError(res, 500, 'OpenAI service not configured');
      }

      console.log('[ChatController] Getting metadata context...');
      // Get metadata context
      let context = null;
      try {
        const powerbiService = new PowerBIService(config);
        const groupId = config.powerBIGroupId;
        const datasetId = config.powerBIDatasetId;
                
        if (groupId && datasetId) {
          console.log('[ChatController] Fetching PowerBI metadata context...');
          context = await powerbiService.getMetadataContext(groupId, datasetId);
          console.log('[ChatController] Metadata context retrieved successfully');
        }
      } catch (contextError) {
        console.log('[ChatController] Metadata context error:', contextError.message);
        console.log('[ChatController] Metadata context error:', contextError.message);
        return errorService.sendError(res, 500, 'Failed to retrieve data context', contextError.message);
      }

      console.log('[ChatController] Initializing OpenAI service...');
      // Generate response using OpenAI service
      try {
        await this.openaiService.initialize();
        console.log('[ChatController] OpenAI service initialized, processing chat...');
                
        const result = await this.openaiService.processChat(
          message,
          context,
          currentChart,
          chatHistory,
          { req, res }
        );

        console.log('[ChatController] Chat processing complete, result:', result);

        res.json({ response: result.response, usage: result.usage });
      } catch (openaiError) {
        console.log('[ChatController] OpenAI error:', openaiError.message);
        return errorService.sendError(res, 500, 'Failed to generate response', openaiError.message);
      }

    } catch (error) {
      return errorService.sendError(res, 500, 'Chat request failed', error.message);
    }
  }

  /**
     * Process streaming chat message with AI
     * POST /chat/stream
     * Body: { message, conversation? }
     */
  async chatStream(req, res) {
    try {
      // Validate request
      const { message, conversation = [] } = req.body || {};
      if (!message || message.trim() === '') {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
                
        res.write('data: {"error": "Message is required"}\n\n');
        res.end();
        return;
      }

      // Set streaming headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      // Load configuration and get context
      const config = configService.loadConfig();
      let context = null;
            
      try {
        const powerbiService = new PowerBIService(config);
        const groupId = config.powerBIGroupId;
        const datasetId = config.powerBIDatasetId;
                
        if (groupId && datasetId) {
          context = await powerbiService.getMetadataContext(groupId, datasetId);
        }
      } catch {
        res.write('data: {"error": "Failed to retrieve data context"}\n\n');
        res.end();
        return;
      }

      // Generate streaming response
      try {
        await this.openaiService.initialize();
        const responseStream = this.openaiService.generateStreamingResponse(
          message,
          Array.isArray(conversation) ? conversation : [],
          context
        );

        for await (const chunk of responseStream) {
          res.write(`data: ${chunk}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        res.end();

      } catch {
        res.write('data: {"error": "Failed to generate streaming response"}\n\n');
        res.end();
      }

    } catch {
      res.setHeader('Content-Type', 'text/event-stream');
      res.write('data: {"error": "Streaming request failed"}\n\n');
      res.end();
    }
  }

  /**
     * Health check for chat service
     * GET /chat/health
     */
  async healthCheck(req, res) {
    try {
      const config = configService.loadConfig();
            
      // Check service configurations
      const openaiConfigured = !!(config.openaiApiKey || (config.azureOpenAIApiKey && config.azureOpenAIEndpoint));
      const powerbiConfigured = !!(config.powerBIGroupId && config.powerBIDatasetId);
            
      let status = 'ok';
      let message = 'Chat service ready';
            
      if (!openaiConfigured || !powerbiConfigured) {
        status = 'degraded';
        message = 'Chat service has configuration issues';
      }

      res.json({
        status,
        service: 'chat',
        message,
        configuration: {
          openaiConfigured,
          powerbiConfigured
        },
        timestamp: new Date().toISOString()
      });
            
    } catch (error) {
      res.json({
        status: 'error',
        service: 'chat',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = ChatController;