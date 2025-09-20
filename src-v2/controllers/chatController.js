const openaiService = require('../services/openaiService');
const PowerBIService = require('../services/powerbiService');
const configService = require('../services/configService');
const errorService = require('../services/errorService');
const telemetry = require('../services/telemetryService');

/**
 * Chat Controller - Handles AI chat functionality
 * Thin wrapper around OpenAI service with metadata integration
 */
class ChatController {
    /**
     * Process chat message with AI
     * POST /chat
     * Body: { message, conversation? }
     */
    static async chat(req, res) {
        console.log('[ChatController] Chat request received:', req.body);
        try {
            // Validate request - extract all expected parameters from original implementation
            const { message, currentChart, chatHistory, conversation = [] } = req.body || {};
            console.log('[ChatController] Extracted message:', message);
            console.log('[ChatController] Extracted currentChart:', currentChart);
            console.log('[ChatController] Extracted chatHistory:', chatHistory);
            
            if (!message || message.trim() === '') {
                console.log('[ChatController] Message validation failed');
                telemetry.recordEvent('chat_response', {
                    message_length: message ? message.length : 0,
                    conversation_length: Array.isArray(conversation) ? conversation.length : 0,
                    success: false,
                    error: 'Message is required'
                });
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
                telemetry.recordEvent('chat_response', {
                    message_length: message.length,
                    conversation_length: Array.isArray(conversation) ? conversation.length : 0,
                    success: false,
                    error: 'OpenAI service not configured'
                });
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
                telemetry.recordEvent('chat_response', {
                    message_length: message.length,
                    conversation_length: Array.isArray(conversation) ? conversation.length : 0,
                    success: false,
                    error: contextError.message
                });
                return errorService.sendError(res, 500, 'Failed to retrieve data context', contextError.message);
            }

            console.log('[ChatController] Initializing OpenAI service...');
            // Generate response using OpenAI service
            try {
                await openaiService.initialize();
                console.log('[ChatController] OpenAI service initialized, processing chat...');
                
                const result = await openaiService.processChat(
                    message,
                    context,
                    currentChart,
                    chatHistory,
                    { req, res }
                );

                console.log('[ChatController] Chat processing complete, result:', result);

                // Record successful telemetry
                telemetry.recordEvent('chat_response', {
                    message_length: message.length,
                    conversation_length: Array.isArray(conversation) ? conversation.length : 0,
                    response_tokens: result.usage?.total_tokens || 0,
                    success: true
                });

                res.json({ response: result.response, usage: result.usage });
            } catch (openaiError) {
                console.log('[ChatController] OpenAI error:', openaiError.message);
                telemetry.recordEvent('chat_response', {
                    message_length: message.length,
                    conversation_length: Array.isArray(conversation) ? conversation.length : 0,
                    success: false,
                    error: openaiError.message
                });
                return errorService.sendError(res, 500, 'Failed to generate response', openaiError.message);
            }

        } catch (error) {
            telemetry.recordEvent('chat_response', {
                message_length: req.body?.message?.length || 0,
                conversation_length: 0,
                success: false,
                error: error.message
            });
            return errorService.sendError(res, 500, 'Chat request failed', error.message);
        }
    }

    /**
     * Process streaming chat message with AI
     * POST /chat/stream
     * Body: { message, conversation? }
     */
    static async chatStream(req, res) {
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
            } catch (contextError) {
                res.write('data: {"error": "Failed to retrieve data context"}\n\n');
                res.end();
                return;
            }

            // Generate streaming response
            let chunkCount = 0;
            try {
                await openaiService.initialize();
                const responseStream = openaiService.generateStreamingResponse(
                    message,
                    Array.isArray(conversation) ? conversation : [],
                    context
                );

                for await (const chunk of responseStream) {
                    res.write(`data: ${chunk}\n\n`);
                    chunkCount++;
                }

                res.write('data: [DONE]\n\n');
                res.end();

                // Record successful telemetry
                telemetry.recordEvent('chat_stream', {
                    message_length: message.length,
                    conversation_length: Array.isArray(conversation) ? conversation.length : 0,
                    chunks_sent: chunkCount,
                    success: true
                });

            } catch (streamError) {
                res.write('data: {"error": "Failed to generate streaming response"}\n\n');
                res.end();

                telemetry.recordEvent('chat_stream', {
                    message_length: message.length,
                    conversation_length: Array.isArray(conversation) ? conversation.length : 0,
                    chunks_sent: chunkCount,
                    success: false,
                    error: streamError.message
                });
            }

        } catch (error) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.write('data: {"error": "Streaming request failed"}\n\n');
            res.end();
        }
    }

    /**
     * Health check for chat service
     * GET /chat/health
     */
    static async healthCheck(req, res) {
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