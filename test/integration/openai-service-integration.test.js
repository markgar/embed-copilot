const request = require('supertest');
const openaiService = require('../../src-v2/services/openaiService');
const configService = require('../../src-v2/services/configService');
const PowerBIService = require('../../src-v2/services/powerbiService');

// Mock only external dependencies, not our services
jest.mock('../../src-v2/services/telemetryService');

// Mock node-fetch for controlled testing
jest.mock('node-fetch');
const fetch = require('node-fetch');

describe('OpenAI Service Integration Tests', () => {
    const mockConfig = {
        azureOpenAIEndpoint: 'https://test.openai.azure.com',
        azureOpenAIApiKey: 'test-api-key-integration',
        azureOpenAIDeploymentName: 'test-deployment-integration',
        azureOpenAIApiVersion: '2023-12-01-preview',
        powerBIGroupId: 'test-group-id',
        powerBIReportId: 'test-report-id',
        powerBIDatasetId: 'test-dataset-id'
    };

    const mockDatasetMetadata = {
        tables: [
            {
                name: 'Sales',
                columns: [
                    { name: 'SalesAmount', dataType: 'Decimal' },
                    { name: 'OrderDate', dataType: 'DateTime' },
                    { name: 'ProductId', dataType: 'Int64' }
                ]
            },
            {
                name: 'Products',
                columns: [
                    { name: 'ProductId', dataType: 'Int64' },
                    { name: 'ProductName', dataType: 'Text' },
                    { name: 'Category', dataType: 'Text' }
                ]
            }
        ],
        measures: [
            {
                name: 'Total Sales',
                expression: 'SUM(Sales[SalesAmount])'
            },
            {
                name: 'Average Sales',
                expression: 'AVERAGE(Sales[SalesAmount])'
            }
        ],
        relationships: [
            {
                fromTable: 'Sales',
                fromColumn: 'ProductId',
                toTable: 'Products',
                toColumn: 'ProductId'
            }
        ]
    };

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Reset service states
        openaiService.initialized = false;
        openaiService.config = null;
        
        // Mock config service with our test config
        jest.spyOn(configService, 'loadConfig').mockReturnValue(mockConfig);
        
        // Mock PowerBI service for metadata retrieval (class, not instance)
        jest.spyOn(PowerBIService.prototype, 'getDatasetMetadata').mockResolvedValue(mockDatasetMetadata);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Service Integration Flow', () => {
        test('should initialize and process chat with PowerBI metadata integration', async () => {
            // Mock successful Azure OpenAI response
            const mockOpenAIResponse = {
                choices: [{
                    message: {
                        content: 'Based on the Sales and Products tables, you can create a DAX query like: EVALUATE SUMMARIZE(Sales, Products[Category], "Total Sales", SUM(Sales[SalesAmount]))'
                    }
                }],
                usage: {
                    prompt_tokens: 150,
                    completion_tokens: 45,
                    total_tokens: 195
                }
            };

            fetch.mockResolvedValue({
                ok: true,
                json: () => new Promise(resolve => setTimeout(() => resolve(mockOpenAIResponse), 10))
            });

            // Initialize services
            await openaiService.initialize();

            // Get metadata from PowerBI service
            const powerbiService = new PowerBIService(mockConfig);
            const metadata = await powerbiService.getDatasetMetadata(mockConfig.powerBIGroupId, mockConfig.powerBIDatasetId);

            // Process chat with metadata context
            const result = await openaiService.processChat(
                'How can I analyze sales by product category?',
                metadata,
                {
                    req: { method: 'POST', url: '/chat', body: { message: 'test' } },
                    res: { statusCode: 200 },
                    metadata: metadata
                }
            );

            expect(result.success).toBe(true);
            expect(result.response).toContain('DAX query');
            expect(result.usage.total_tokens).toBe(195);
            expect(result.duration).toBeGreaterThan(0);

            // Verify the API call included comprehensive system prompt
            expect(fetch).toHaveBeenCalledTimes(1);
            const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
            
            expect(requestBody.messages).toHaveLength(2);
            expect(requestBody.messages[0].role).toBe('system');
            expect(requestBody.messages[0].content).toContain('Sales.SalesAmount');
            expect(requestBody.messages[0].content).toContain('Products.ProductName');
            expect(requestBody.messages[0].content).toContain('SCHEMA (table.column [type])');
            expect(requestBody.messages[0].content).toContain('specialized Power BI chart creation assistant');
            
            expect(requestBody.messages[1].role).toBe('user');
            expect(requestBody.messages[1].content).toBe('How can I analyze sales by product category?');
        });

        test('should handle chat processing without metadata', async () => {
            const mockOpenAIResponse = {
                choices: [{
                    message: {
                        content: 'I can help you with Power BI and DAX queries. Please provide more details about your dataset.'
                    }
                }]
            };

            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockOpenAIResponse)
            });

            await openaiService.initialize();

            const result = await openaiService.processChat('Hello, can you help me with Power BI?');

            expect(result.success).toBe(true);
            expect(result.response).toContain('Power BI');

            // Verify system prompt doesn't include dataset-specific information
            const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
            expect(requestBody.messages[0].content).not.toContain('Available Tables');
            expect(requestBody.messages[0].content).not.toContain('Available Measures');
        });

        test('should handle Azure OpenAI API errors gracefully', async () => {
            fetch.mockResolvedValue({
                ok: false,
                status: 429,
                text: () => Promise.resolve('Rate limit exceeded')
            });

            await openaiService.initialize();

            await expect(
                openaiService.processChat('Test message')
            ).rejects.toThrow('Chat completion failed: Azure OpenAI API error (429): Rate limit exceeded');
        });

        test('should handle network connectivity issues', async () => {
            fetch.mockRejectedValue(new Error('ECONNREFUSED'));

            await openaiService.initialize();

            await expect(
                openaiService.processChat('Test message')
            ).rejects.toThrow('Chat completion failed: ECONNREFUSED');
        });
    });

    describe('End-to-End Chat Scenarios', () => {
        beforeEach(async () => {
            await openaiService.initialize();
        });

        test('should handle DAX query request with full context', async () => {
            const mockResponse = {
                choices: [{
                    message: {
                        content: `Here's a DAX query to get total sales by category:

EVALUATE
SUMMARIZE(
    Sales,
    Products[Category],
    "Total Sales", SUM(Sales[SalesAmount]),
    "Average Sales", AVERAGE(Sales[SalesAmount])
)

This query uses the relationship between Sales and Products tables via ProductId.`
                    }
                }],
                usage: { prompt_tokens: 200, completion_tokens: 80, total_tokens: 280 }
            };

            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            const powerbiService = new PowerBIService(mockConfig);
            const metadata = await powerbiService.getDatasetMetadata(mockConfig.powerBIGroupId, mockConfig.powerBIDatasetId);
            const result = await openaiService.processChat(
                'Create a DAX query to show total and average sales by product category',
                metadata
            );

            expect(result.success).toBe(true);
            expect(result.response).toContain('EVALUATE');
            expect(result.response).toContain('SUMMARIZE');
            expect(result.response).toContain('Sales[SalesAmount]');
            expect(result.response).toContain('Products[Category]');
        });

        test('should handle data exploration questions', async () => {
            const mockResponse = {
                choices: [{
                    message: {
                        content: `Based on your dataset, you have:

1. **Sales Table**: Contains transaction data with SalesAmount, OrderDate, and ProductId
2. **Products Table**: Contains product information with ProductId, ProductName, and Category
3. **Relationship**: Sales and Products are connected via ProductId

You can explore:
- Sales trends over time using OrderDate
- Product performance by Category
- Top-selling products by combining both tables

The available measures (Total Sales, Average Sales) can help with quick insights.`
                    }
                }]
            };

            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            const powerbiService = new PowerBIService(mockConfig);
            const metadata = await powerbiService.getDatasetMetadata(mockConfig.powerBIGroupId, mockConfig.powerBIDatasetId);
            const result = await openaiService.processChat(
                'What data do I have available for analysis?',
                metadata
            );

            expect(result.success).toBe(true);
            expect(result.response).toContain('Sales Table');
            expect(result.response).toContain('Products Table');
            expect(result.response).toContain('ProductId');
        });

        test('should handle performance optimization questions', async () => {
            const mockResponse = {
                choices: [{
                    message: {
                        content: `For optimal performance with your Sales and Products data:

1. **Use existing measures**: Your "Total Sales" and "Average Sales" measures are already optimized
2. **Filter early**: Use Products[Category] filters before aggregating Sales[SalesAmount]
3. **Leverage relationships**: The ProductId relationship is properly configured for efficient joins

Example optimized query:
EVALUATE
FILTER(
    SUMMARIZE(Products, Products[Category], "Sales", [Total Sales]),
    [Sales] > 1000
)`
                    }
                }]
            };

            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            const powerbiService = new PowerBIService(mockConfig);
            const metadata = await powerbiService.getDatasetMetadata(mockConfig.powerBIGroupId, mockConfig.powerBIDatasetId);
            const result = await openaiService.processChat(
                'How can I optimize my queries for better performance?',
                metadata
            );

            expect(result.success).toBe(true);
            expect(result.response).toContain('performance');
            expect(result.response).toContain('Total Sales');
            expect(result.response).toContain('Products[Category]');
        });
    });

    describe('Error Recovery and Resilience', () => {
        beforeEach(async () => {
            await openaiService.initialize();
        });

        test('should handle partial Azure OpenAI responses', async () => {
            const mockResponse = {
                choices: [{
                    message: { content: 'Partial response...' },
                    finish_reason: 'length'
                }],
                usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
            };

            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            const result = await openaiService.processChat('Create a complex DAX query');

            expect(result.success).toBe(true);
            expect(result.response).toBe('Partial response...');
            expect(result.usage.total_tokens).toBe(150);
        });

        test('should handle malformed JSON responses', async () => {
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.reject(new Error('Invalid JSON'))
            });

            await expect(
                openaiService.processChat('Test message')
            ).rejects.toThrow('Chat completion failed: Invalid JSON');
        });

        test('should handle empty response choices', async () => {
            const mockResponse = {
                choices: [],
                usage: { prompt_tokens: 50, completion_tokens: 0, total_tokens: 50 }
            };

            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            const result = await openaiService.processChat('Test message');

            expect(result.success).toBe(true);
            expect(result.response).toBe('No response generated');
            expect(result.usage.total_tokens).toBe(50);
        });

        test('should handle service unavailable scenarios', async () => {
            fetch.mockResolvedValue({
                ok: false,
                status: 503,
                text: () => Promise.resolve('Service Unavailable - Azure OpenAI is temporarily down')
            });

            await expect(
                openaiService.processChat('Test message')
            ).rejects.toThrow('Chat completion failed: Azure OpenAI API error (503): Service Unavailable');
        });
    });

    describe('Configuration Edge Cases', () => {
        test('should handle missing API version gracefully', async () => {
            const configWithoutVersion = { ...mockConfig };
            delete configWithoutVersion.azureOpenAIApiVersion;

            jest.spyOn(configService, 'loadConfig').mockReturnValue(configWithoutVersion);

            await openaiService.initialize();

            const mockResponse = {
                choices: [{ message: { content: 'Test response' } }]
            };

            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            await openaiService.processChat('Test message');

            // Should use default API version
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('api-version=2023-12-01-preview'),
                expect.any(Object)
            );
        });

        test('should handle custom API version', async () => {
            const configWithCustomVersion = {
                ...mockConfig,
                azureOpenAIApiVersion: '2024-02-01-preview'
            };

            jest.spyOn(configService, 'loadConfig').mockReturnValue(configWithCustomVersion);

            await openaiService.initialize();

            const mockResponse = {
                choices: [{ message: { content: 'Test response' } }]
            };

            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            await openaiService.processChat('Test message');

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('api-version=2024-02-01-preview'),
                expect.any(Object)
            );
        });
    });
});