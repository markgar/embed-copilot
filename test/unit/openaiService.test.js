const openaiService = require('../../src-v2/services/openaiService');
const configService = require('../../src-v2/services/configService');
const telemetry = require('../../src-v2/services/telemetryService');

// Mock dependencies
jest.mock('../../src-v2/services/configService');
jest.mock('../../src-v2/services/telemetryService');

// Mock node-fetch since that's what the service uses
jest.mock('node-fetch', () => jest.fn());
const mockFetch = require('node-fetch');

describe('OpenAI Service', () => {
    const mockConfig = {
        azureOpenAIEndpoint: 'https://test.openai.azure.com',
        azureOpenAIApiKey: 'test-api-key',
        azureOpenAIDeploymentName: 'test-deployment',
        azureOpenAIApiVersion: '2023-12-01-preview'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Reset service state
        openaiService.initialized = false;
        openaiService.config = null;
        
        // Mock config service
        configService.loadConfig.mockReturnValue(mockConfig);
        
        // Mock telemetry
        telemetry.logRequest.mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Initialization', () => {
        test('should initialize successfully with valid config', async () => {
            await openaiService.initialize();
            
            expect(openaiService.initialized).toBe(true);
            expect(openaiService.config).toEqual(mockConfig);
            expect(configService.loadConfig).toHaveBeenCalledTimes(1);
        });

        test('should throw error if config loading fails', async () => {
            const error = new Error('Config load failed');
            configService.loadConfig.mockImplementation(() => {
                throw error;
            });
            
            await expect(openaiService.initialize()).rejects.toThrow('Failed to initialize OpenAI service: Config load failed');
            expect(openaiService.initialized).toBe(false);
        });

        test('should throw error when using service before initialization', () => {
            expect(() => openaiService.buildSystemPrompt()).toThrow('OpenAI service not initialized. Call initialize() first.');
            expect(() => openaiService._validateConfig()).toThrow('OpenAI service not initialized. Call initialize() first.');
        });
    });

    describe('Configuration Validation', () => {
        beforeEach(async () => {
            await openaiService.initialize();
        });

        test('should validate complete config successfully', () => {
            expect(() => openaiService._validateConfig()).not.toThrow();
        });

        test('should throw error for missing endpoint', () => {
            openaiService.config = { ...mockConfig, azureOpenAIEndpoint: '' };
            expect(() => openaiService._validateConfig()).toThrow('Missing Azure OpenAI configuration: azureOpenAIEndpoint');
        });

        test('should throw error for missing API key', () => {
            openaiService.config = { ...mockConfig, azureOpenAIApiKey: null };
            expect(() => openaiService._validateConfig()).toThrow('Missing Azure OpenAI configuration: azureOpenAIApiKey');
        });

        test('should throw error for missing deployment name', () => {
            openaiService.config = { ...mockConfig, azureOpenAIDeploymentName: undefined };
            expect(() => openaiService._validateConfig()).toThrow('Missing Azure OpenAI configuration: azureOpenAIDeploymentName');
        });

        test('should throw error for multiple missing configs', () => {
            openaiService.config = { ...mockConfig, azureOpenAIEndpoint: '', azureOpenAIApiKey: '' };
            expect(() => openaiService._validateConfig()).toThrow('Missing Azure OpenAI configuration: azureOpenAIEndpoint, azureOpenAIApiKey');
        });
    });

    describe('System Prompt Building', () => {
        beforeEach(async () => {
            await openaiService.initialize();
        });

        test('should build basic system prompt without metadata', () => {
            const prompt = openaiService.buildSystemPrompt();
            
            expect(prompt).toContain('You are a specialized Power BI chart creation assistant');
            expect(prompt).toContain('CORE RESPONSIBILITIES');
            expect(prompt).toContain('CHART TYPES');
            expect(prompt).toContain('Schema temporarily unavailable');
            expect(prompt).not.toContain('Dataset Information');
        });

        test('should build enhanced prompt with table metadata', () => {
            const metadata = {
                tables: [
                    { 
                        name: 'Sales',
                        columns: [
                            { name: 'Amount', type: 'Decimal' },
                            { name: 'Date', type: 'DateTime' }
                        ]
                    },
                    {
                        name: 'Products',
                        columns: [
                            { name: 'ProductName', type: 'Text' },
                            { name: 'Category', type: 'Text' }
                        ]
                    }
                ]
            };

            const prompt = openaiService.buildSystemPrompt(metadata);
            
            expect(prompt).toContain('SCHEMA (table.column [type]):');
            expect(prompt).toContain('Sales.Amount [Decimal]');
            expect(prompt).toContain('Sales.Date [DateTime]');
            expect(prompt).toContain('Products.ProductName [Text]');
            expect(prompt).toContain('Products.Category [Text]');
        });

        test('should build enhanced prompt with measures metadata', () => {
            const metadata = {
                measures: [
                    {
                        name: 'Total Sales',
                        expression: 'SUM(Sales[Amount])'
                    },
                    {
                        name: 'Average Sales'
                        // No expression provided
                    }
                ]
            };

            const prompt = openaiService.buildSystemPrompt(metadata);
            
            // Current implementation doesn't process measures metadata - it only processes tables
            expect(prompt).toContain('You are a specialized Power BI chart creation assistant');
            expect(prompt).toContain('Schema temporarily unavailable');
            expect(prompt).not.toContain('Available Measures:');
        });

        test('should build enhanced prompt with relationships metadata', () => {
            const metadata = {
                relationships: [
                    {
                        fromTable: 'Sales',
                        fromColumn: 'ProductId',
                        toTable: 'Products',
                        toColumn: 'Id'
                    }
                ]
            };

            const prompt = openaiService.buildSystemPrompt(metadata);
            
            // Current implementation doesn't process relationships metadata - it only processes tables
            expect(prompt).toContain('You are a specialized Power BI chart creation assistant');
            expect(prompt).toContain('Schema temporarily unavailable');
            expect(prompt).not.toContain('Table Relationships:');
        });

        test('should build comprehensive prompt with all metadata types', () => {
            const metadata = {
                tables: [{ name: 'Sales', columns: [{ name: 'Amount', type: 'Decimal' }] }],
                measures: [{ name: 'Total Sales', expression: 'SUM(Sales[Amount])' }],
                relationships: [{ fromTable: 'Sales', fromColumn: 'ProductId', toTable: 'Products', toColumn: 'Id' }]
            };

            const prompt = openaiService.buildSystemPrompt(metadata);
            
            // Current implementation only processes tables, not measures or relationships
            expect(prompt).toContain('SCHEMA (table.column [type]):');
            expect(prompt).toContain('Sales.Amount [Decimal]');
            expect(prompt).not.toContain('Available Measures:');
            expect(prompt).not.toContain('Table Relationships:');
        });
    });

    describe('Chat Processing', () => {
        beforeEach(async () => {
            await openaiService.initialize();
        });

        test('should process chat successfully with valid response', async () => {
            const mockResponse = {
                choices: [{
                    message: { content: 'This is a test response' }
                }],
                usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 }
            };

            mockFetch.mockResolvedValue({
                ok: true,
                json: () => new Promise(resolve => setTimeout(() => resolve(mockResponse), 10))
            });

            const result = await openaiService.processChat('Test message');

            expect(result.success).toBe(true);
            expect(result.response).toBe('This is a test response');
            expect(result.usage).toEqual(mockResponse.usage);
            expect(result.duration).toBeGreaterThan(0);

            // Verify API call
            expect(mockFetch).toHaveBeenCalledWith(
                'https://test.openai.azure.com/openai/deployments/test-deployment/chat/completions?api-version=2023-12-01-preview',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'api-key': 'test-api-key'
                    },
                    body: expect.stringContaining('"messages"')
                }
            );
        });

        test('should process chat with metadata context', async () => {
            const mockResponse = {
                choices: [{ message: { content: 'Response with context' } }]
            };

            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            const metadata = {
                tables: [{ name: 'Sales', columns: [{ name: 'Amount', dataType: 'Decimal' }] }]
            };

            const result = await openaiService.processChat('Test message', metadata);

            expect(result.success).toBe(true);
            expect(result.response).toBe('Response with context');

            // Verify request body includes system prompt with metadata
            const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(requestBody.messages[0].role).toBe('system');
            expect(requestBody.messages[0].content).toContain('Sales');
            expect(requestBody.messages[1].role).toBe('user');
            expect(requestBody.messages[1].content).toBe('Test message');
        });

        test('should handle API error responses', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 401,
                text: () => Promise.resolve('Unauthorized')
            });

            await expect(openaiService.processChat('Test message')).rejects.toThrow('Chat completion failed: Azure OpenAI API error (401): Unauthorized');
        });

        test('should handle network errors', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            await expect(openaiService.processChat('Test message')).rejects.toThrow('Chat completion failed: Network error');
        });

        test('should handle missing response content', async () => {
            const mockResponse = {
                choices: [{ message: {} }] // No content
            };

            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            const result = await openaiService.processChat('Test message');

            expect(result.success).toBe(true);
            expect(result.response).toBe('No response generated');
        });

        test('should throw error if config is invalid', async () => {
            openaiService.config = { ...mockConfig, azureOpenAIApiKey: '' };

            await expect(openaiService.processChat('Test message')).rejects.toThrow('Chat completion failed: Missing Azure OpenAI configuration: azureOpenAIApiKey');
        });

        test('should log telemetry for successful requests', async () => {
            const mockResponse = {
                choices: [{ message: { content: 'Test response' } }]
            };

            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            const telemetryContext = {
                req: { method: 'POST', url: '/chat' },
                res: { statusCode: 200 }
            };

            await openaiService.processChat('Test message', null, null, null, telemetryContext);

            expect(telemetry.logRequest).toHaveBeenCalledWith(
                telemetryContext.req,
                telemetryContext.res,
                expect.objectContaining({
                    type: 'chat_completion',
                    request: expect.objectContaining({
                        message: 'Test message',
                        hasMetadata: false
                    }),
                    response: expect.objectContaining({
                        generated: true,
                        length: 13
                    }),
                    context: expect.objectContaining({
                        endpoint: '/chat',
                        service: 'openai'
                    })
                }),
                expect.any(Number)
            );
        });

        test('should log telemetry for failed requests', async () => {
            mockFetch.mockRejectedValue(new Error('API failure'));

            const telemetryContext = {
                req: { method: 'POST', url: '/chat' },
                res: { statusCode: 500 }
            };

            try {
                await openaiService.processChat('Test message', null, null, null, telemetryContext);
            } catch (error) {
                // Expected to throw
            }

            expect(telemetry.logRequest).toHaveBeenCalledWith(
                telemetryContext.req,
                telemetryContext.res,
                expect.objectContaining({
                    type: 'chat_completion',
                    error: expect.objectContaining({
                        message: 'API failure',
                        type: 'Error'
                    })
                }),
                expect.any(Number)
            );
        });
    });

    describe('Status and Health', () => {
        test('should return status before initialization', () => {
            const status = openaiService.getStatus();
            
            expect(status.initialized).toBe(false);
            expect(status.hasConfig).toBe(false);
            expect(status.configValid).toBe(false);
        });

        test('should return status after successful initialization', async () => {
            await openaiService.initialize();
            const status = openaiService.getStatus();
            
            expect(status.initialized).toBe(true);
            expect(status.hasConfig).toBe(true);
            expect(status.configValid).toBe(true);
        });

        test('should return status with invalid config', async () => {
            await openaiService.initialize();
            openaiService.config = { ...mockConfig, azureOpenAIApiKey: '' };
            
            const status = openaiService.getStatus();
            
            expect(status.initialized).toBe(true);
            expect(status.hasConfig).toBe(true);
            expect(status.configValid).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        beforeEach(async () => {
            await openaiService.initialize();
        });

        test('should handle empty metadata gracefully', () => {
            const prompt = openaiService.buildSystemPrompt({});
            expect(prompt).toContain('You are a specialized Power BI chart creation assistant');
            expect(prompt).toContain('Schema temporarily unavailable');
            expect(prompt).not.toContain('Available Tables');
        });

        test('should handle metadata with empty arrays', () => {
            const metadata = {
                tables: [],
                measures: [],
                relationships: []
            };
            
            const prompt = openaiService.buildSystemPrompt(metadata);
            expect(prompt).toContain('You are a specialized Power BI chart creation assistant');
            expect(prompt).toContain('SCHEMA (table.column [type]):');
            expect(prompt).not.toContain('Available Tables');
        });

        test('should handle malformed API response gracefully', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({}) // Empty response
            });

            const result = await openaiService.processChat('Test message');
            
            expect(result.success).toBe(true);
            expect(result.response).toBe('No response generated');
            expect(result.usage).toBeNull();
        });

        test('should handle telemetry logging errors gracefully', async () => {
            const mockResponse = {
                choices: [{ message: { content: 'Test response' } }]
            };

            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            // Mock telemetry to throw
            telemetry.logRequest.mockImplementation(() => {
                throw new Error('Telemetry error');
            });

            // Should not throw despite telemetry error
            const result = await openaiService.processChat('Test message', null, {
                req: {},
                res: {}
            });

            expect(result.success).toBe(true);
            expect(result.response).toBe('Test response');
        });
    });
});