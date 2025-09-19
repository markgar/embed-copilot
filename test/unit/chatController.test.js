const ChatController = require('../../src-v2/controllers/chatController');
const OpenAIService = require('../../src-v2/services/openaiService');
const PowerBIService = require('../../src-v2/services/powerbiService');
const errorService = require('../../src-v2/services/errorService');
const telemetry = require('../../src/telemetry');

// Mock dependencies
jest.mock('../../src-v2/services/openaiService');
jest.mock('../../src-v2/services/powerbiService');
jest.mock('../../src-v2/services/errorService');
jest.mock('../../src/telemetry');

// Mock configService properly
jest.mock('../../src-v2/services/configService', () => ({
    configService: {
        loadConfig: jest.fn()
    }
}));

const { configService } = require('../../src-v2/services/configService');

describe('ChatController', () => {
    let req, res;
    const mockConfig = {
        powerBIGroupId: 'test-group-id',
        powerBIDatasetId: 'test-dataset-id',
        openaiApiKey: 'test-api-key',
        openaiModel: 'gpt-4'
    };

    const mockContext = {
        dataset: { name: 'Test Dataset' },
        schema: 'Sales.Amount [Decimal]\nSales.Date [DateTime]'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        
        req = {
            body: {
                message: 'What are total sales?',
                conversation: []
            },
            method: 'POST',
            url: '/chat'
        };
        
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            write: jest.fn(),
            end: jest.fn(),
            setHeader: jest.fn()
        };

        // Mock services
        configService.loadConfig = jest.fn().mockReturnValue(mockConfig);
        errorService.sendError = jest.fn();
        telemetry.recordEvent = jest.fn();
    });

    describe('chat', () => {
        test('should successfully process chat request', async () => {
            const mockResponse = {
                response: 'To get total sales, use: SUM(Sales[Amount])',
                usage: { total_tokens: 150 }
            };

            // Mock OpenAI service methods directly (since it's a singleton)
            OpenAIService.processChat = jest.fn().mockResolvedValue(mockResponse);

            const mockPowerBIService = {
                getMetadataContext: jest.fn().mockResolvedValue(mockContext)
            };
            PowerBIService.mockImplementation(() => mockPowerBIService);

            await ChatController.chat(req, res);

            expect(configService.loadConfig).toHaveBeenCalledTimes(1);
            expect(OpenAIService).toHaveBeenCalledWith(mockConfig);
            expect(PowerBIService).toHaveBeenCalledWith(mockConfig);
            
            expect(mockPowerBIService.getMetadataContext).toHaveBeenCalledWith(
                'test-group-id',
                'test-dataset-id'
            );
            
            expect(mockOpenAIService.generateResponse).toHaveBeenCalledWith(
                'What are total sales?',
                [],
                mockContext
            );

            expect(res.json).toHaveBeenCalledWith(mockResponse);
            expect(telemetry.recordEvent).toHaveBeenCalledWith('chat_response', {
                message_length: req.body.message.length,
                conversation_length: 0,
                response_tokens: 150,
                success: true
            });
        });

        test('should handle requests with conversation history', async () => {
            req.body.conversation = [
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi there!' }
            ];

            const mockResponse = {
                message: 'Based on our previous conversation...',
                usage: { total_tokens: 200 }
            };

            const mockOpenAIService = {
                generateResponse: jest.fn().mockResolvedValue(mockResponse)
            };
            OpenAIService.mockImplementation(() => mockOpenAIService);

            const mockPowerBIService = {
                getMetadataContext: jest.fn().mockResolvedValue(mockContext)
            };
            PowerBIService.mockImplementation(() => mockPowerBIService);

            await ChatController.chat(req, res);

            expect(mockOpenAIService.generateResponse).toHaveBeenCalledWith(
                'What are total sales?',
                req.body.conversation,
                mockContext
            );

            expect(telemetry.recordEvent).toHaveBeenCalledWith('chat_response', {
                message_length: req.body.message.length,
                conversation_length: 2,
                response_tokens: 200,
                success: true
            });
        });

        test('should handle missing message in request body', async () => {
            req.body = { conversation: [] };

            await ChatController.chat(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(
                res,
                400,
                'Message is required'
            );
            expect(telemetry.recordEvent).toHaveBeenCalledWith('chat_response', {
                message_length: 0,
                conversation_length: 0,
                success: false,
                error: 'Message is required'
            });
        });

        test('should handle empty message', async () => {
            req.body.message = '';

            await ChatController.chat(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(
                res,
                400,
                'Message is required'
            );
        });

        test('should handle metadata context errors', async () => {
            const contextError = new Error('Failed to get metadata');
            const mockPowerBIService = {
                getMetadataContext: jest.fn().mockRejectedValue(contextError)
            };
            PowerBIService.mockImplementation(() => mockPowerBIService);

            await ChatController.chat(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(
                res,
                500,
                'Failed to retrieve data context',
                'Failed to get metadata'
            );
            expect(telemetry.recordEvent).toHaveBeenCalledWith('chat_response', {
                message_length: req.body.message.length,
                conversation_length: 0,
                success: false,
                error: 'Failed to get metadata'
            });
        });

        test('should handle OpenAI service errors', async () => {
            const openaiError = new Error('OpenAI API error');
            const mockOpenAIService = {
                generateResponse: jest.fn().mockRejectedValue(openaiError)
            };
            OpenAIService.mockImplementation(() => mockOpenAIService);

            const mockPowerBIService = {
                getMetadataContext: jest.fn().mockResolvedValue(mockContext)
            };
            PowerBIService.mockImplementation(() => mockPowerBIService);

            await ChatController.chat(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(
                res,
                500,
                'Failed to generate response',
                'OpenAI API error'
            );
            expect(telemetry.recordEvent).toHaveBeenCalledWith('chat_response', {
                message_length: req.body.message.length,
                conversation_length: 0,
                success: false,
                error: 'OpenAI API error'
            });
        });

        test('should handle missing OpenAI configuration', async () => {
            const configWithoutOpenAI = {
                powerBIGroupId: 'test-group-id',
                powerBIDatasetId: 'test-dataset-id'
            };
            configService.loadConfig.mockReturnValue(configWithoutOpenAI);

            await ChatController.chat(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(
                res,
                500,
                'OpenAI service not configured'
            );
        });
    });

    describe('chatStream', () => {
        test('should successfully stream chat response', async () => {
            const mockStreamResponse = ['chunk1', 'chunk2', 'chunk3'];
            const mockOpenAIService = {
                generateStreamingResponse: jest.fn().mockImplementation(async function* () {
                    for (const chunk of mockStreamResponse) {
                        yield chunk;
                    }
                })
            };
            OpenAIService.mockImplementation(() => mockOpenAIService);

            const mockPowerBIService = {
                getMetadataContext: jest.fn().mockResolvedValue(mockContext)
            };
            PowerBIService.mockImplementation(() => mockPowerBIService);

            await ChatController.chatStream(req, res);

            expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
            expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
            expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
            expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');

            expect(mockOpenAIService.generateStreamingResponse).toHaveBeenCalledWith(
                'What are total sales?',
                [],
                mockContext
            );

            // Verify chunks were written
            expect(res.write).toHaveBeenCalledTimes(mockStreamResponse.length + 1); // +1 for final done message
            expect(res.write).toHaveBeenCalledWith('data: chunk1\n\n');
            expect(res.write).toHaveBeenCalledWith('data: chunk2\n\n');
            expect(res.write).toHaveBeenCalledWith('data: chunk3\n\n');
            expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
            expect(res.end).toHaveBeenCalledTimes(1);

            expect(telemetry.recordEvent).toHaveBeenCalledWith('chat_stream', {
                message_length: req.body.message.length,
                conversation_length: 0,
                chunks_sent: 3,
                success: true
            });
        });

        test('should handle streaming errors', async () => {
            const streamError = new Error('Streaming failed');
            const mockOpenAIService = {
                generateStreamingResponse: jest.fn().mockImplementation(async function* () {
                    throw streamError;
                })
            };
            OpenAIService.mockImplementation(() => mockOpenAIService);

            const mockPowerBIService = {
                getMetadataContext: jest.fn().mockResolvedValue(mockContext)
            };
            PowerBIService.mockImplementation(() => mockPowerBIService);

            await ChatController.chatStream(req, res);

            expect(res.write).toHaveBeenCalledWith('data: {"error": "Failed to generate streaming response"}\n\n');
            expect(res.end).toHaveBeenCalledTimes(1);
            
            expect(telemetry.recordEvent).toHaveBeenCalledWith('chat_stream', {
                message_length: req.body.message.length,
                conversation_length: 0,
                chunks_sent: 0,
                success: false,
                error: 'Streaming failed'
            });
        });

        test('should handle missing message in streaming request', async () => {
            req.body = {};

            await ChatController.chatStream(req, res);

            expect(res.write).toHaveBeenCalledWith('data: {"error": "Message is required"}\n\n');
            expect(res.end).toHaveBeenCalledTimes(1);
        });
    });

    describe('healthCheck', () => {
        test('should return healthy status when properly configured', async () => {
            await ChatController.healthCheck(req, res);

            expect(res.json).toHaveBeenCalledWith({
                status: 'ok',
                service: 'chat',
                message: 'Chat service ready',
                configuration: {
                    openaiConfigured: true,
                    powerbiConfigured: true
                },
                timestamp: expect.any(String)
            });
        });

        test('should show configuration issues', async () => {
            const incompleteConfig = {
                powerBIGroupId: 'test-group-id'
                // Missing OpenAI and PowerBI dataset config
            };
            configService.loadConfig.mockReturnValue(incompleteConfig);

            await ChatController.healthCheck(req, res);

            expect(res.json).toHaveBeenCalledWith({
                status: 'degraded',
                service: 'chat',
                message: 'Chat service has configuration issues',
                configuration: {
                    openaiConfigured: false,
                    powerbiConfigured: false
                },
                timestamp: expect.any(String)
            });
        });

        test('should handle partial configuration', async () => {
            const partialConfig = {
                openaiApiKey: 'test-key',
                powerBIGroupId: 'test-group-id'
                // Missing powerBIDatasetId
            };
            configService.loadConfig.mockReturnValue(partialConfig);

            await ChatController.healthCheck(req, res);

            const call = res.json.mock.calls[0][0];
            expect(call.status).toBe('degraded');
            expect(call.configuration.openaiConfigured).toBe(true);
            expect(call.configuration.powerbiConfigured).toBe(false);
        });
    });

    describe('input validation', () => {
        test('should handle malformed conversation array', async () => {
            req.body.conversation = 'not an array';

            const mockOpenAIService = {
                generateResponse: jest.fn().mockResolvedValue({ message: 'response' })
            };
            OpenAIService.mockImplementation(() => mockOpenAIService);

            const mockPowerBIService = {
                getMetadataContext: jest.fn().mockResolvedValue(mockContext)
            };
            PowerBIService.mockImplementation(() => mockPowerBIService);

            await ChatController.chat(req, res);

            // Should default to empty array when conversation is not an array
            expect(mockOpenAIService.generateResponse).toHaveBeenCalledWith(
                req.body.message,
                [],
                mockContext
            );
        });

        test('should handle very long messages', async () => {
            req.body.message = 'x'.repeat(10000); // Very long message

            const mockResponse = { message: 'response', usage: { total_tokens: 100 } };
            const mockOpenAIService = {
                generateResponse: jest.fn().mockResolvedValue(mockResponse)
            };
            OpenAIService.mockImplementation(() => mockOpenAIService);

            const mockPowerBIService = {
                getMetadataContext: jest.fn().mockResolvedValue(mockContext)
            };
            PowerBIService.mockImplementation(() => mockPowerBIService);

            await ChatController.chat(req, res);

            expect(telemetry.recordEvent).toHaveBeenCalledWith('chat_response', {
                message_length: 10000,
                conversation_length: 0,
                response_tokens: 100,
                success: true
            });
        });

        test('should handle missing request body', async () => {
            req.body = undefined;

            await ChatController.chat(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(
                res,
                400,
                'Message is required'
            );
        });
    });
});