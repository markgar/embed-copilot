const OpenAIService = require('../../src-v2/services/openaiService');
const configService = require('../../src-v2/services/configService');
const fs = require('fs').promises;
const path = require('path');

/**
 * OpenAI Performance Logging Tests
 * Records performance metrics and model information for regression tracking
 */
describe('OpenAI Performance Recording', () => {
    let openaiService;
    const performanceLog = [];

    // Mock configuration that should work for testing
    const mockConfig = {
        azureOpenAIEndpoint: 'https://test.openai.azure.com',
        azureOpenAIApiKey: 'test-key-12345',
        azureOpenAIDeploymentName: 'gpt-5-chat', // Your actual model
        azureOpenAIApiVersion: '2024-12-01-preview'
    };

    // Sample metadata matching your Power BI dataset structure
    const mockMetadata = {
        tables: [
            {
                name: 'Sales',
                columns: [
                    { name: 'TotalSales', dataType: 'Double' },
                    { name: 'TotalUnits', dataType: 'Int64' }
                ]
            },
            {
                name: 'Time',
                columns: [
                    { name: 'Month', dataType: 'Text' },
                    { name: 'Year', dataType: 'Int64' }
                ]
            },
            {
                name: 'District',
                columns: [
                    { name: 'District', dataType: 'Text' }
                ]
            }
        ]
    };

    beforeAll(async () => {
        // Mock the config service
        jest.spyOn(configService, 'loadConfig').mockReturnValue(mockConfig);
        
        // Use the singleton service instance
        openaiService = require('../../src-v2/services/openaiService');
        await openaiService.initialize();
    });

    afterAll(async () => {
        // Write performance log to file
        const logPath = path.join(__dirname, '../logs/openai-performance.json');
        
        // Ensure logs directory exists
        await fs.mkdir(path.dirname(logPath), { recursive: true });
        
        const performanceReport = {
            timestamp: new Date().toISOString(),
            model: mockConfig.azureOpenAIDeploymentName,
            apiVersion: mockConfig.azureOpenAIApiVersion,
            testRun: {
                totalTests: performanceLog.length,
                totalDuration: performanceLog.reduce((sum, test) => sum + test.duration, 0),
                averageDuration: performanceLog.length > 0 ? 
                    performanceLog.reduce((sum, test) => sum + test.duration, 0) / performanceLog.length : 0
            },
            tests: performanceLog
        };

        await fs.writeFile(logPath, JSON.stringify(performanceReport, null, 2));
        
        // Performance summary logged to file at ${logPath}
    });

    const recordPerformance = async (testName, testFunction) => {
        const startTime = Date.now();
        const result = await testFunction();
        const duration = Date.now() - startTime;
        
        const logEntry = {
            testName,
            duration,
            timestamp: new Date().toISOString(),
            success: result.success,
            responseLength: result.response ? result.response.length : 0,
            usage: result.usage || null
        };
        
        performanceLog.push(logEntry);
        
        // Test completed in ${duration}ms
        return result;
    };

    describe('Schema Inquiry Performance', () => {
        test('Performance: "show me the fields" response time', async () => {
            // Mock fetch to return a schema response
            const mockApiResponse = {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            "chatResponse": "## Available Fields\\n\\nYou can use these fields for creating charts:\\n\\n**Sales**:\\n- `Sales.TotalSales` - Total sales amount\\n- `Sales.TotalUnits` - Total units sold\\n\\n**Time**:\\n- `Time.Month` - Month of the year\\n- `Time.Year` - Calendar year\\n\\n**District**:\\n- `District.District` - Sales district name"
                        })
                    }
                }],
                usage: { 
                    total_tokens: 150, 
                    prompt_tokens: 100, 
                    completion_tokens: 50 
                }
            };

            const mockFetch = require('node-fetch');
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockApiResponse)
            });

            const result = await recordPerformance('Schema Fields Query', async () => {
                return await openaiService.processChat(
                    'show me the fields',
                    mockMetadata,
                    null,
                    null,
                    { req: {}, res: {} }
                );
            });

            expect(result.success).toBe(true);
        });

        test('Performance: "what fields are available?" response time', async () => {
            const mockApiResponse = {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            "chatResponse": "## Available Fields\\n\\nHere are all the fields you can use for creating charts..."
                        })
                    }
                }],
                usage: { total_tokens: 180, prompt_tokens: 120, completion_tokens: 60 }
            };

            const mockFetch = require('node-fetch');
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockApiResponse)
            });

            const result = await recordPerformance('Schema Available Query', async () => {
                return await openaiService.processChat(
                    'what fields are available?',
                    mockMetadata,
                    null,
                    null,
                    { req: {}, res: {} }
                );
            });

            expect(result.success).toBe(true);
        });
    });

    describe('Chart Creation Performance', () => {
        test('Performance: "show me sales by month" response time', async () => {
            const mockApiResponse = {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            "chatResponse": "I'll create a line chart showing sales by month!",
                            "chartAction": {
                                "yAxis": "Sales.TotalSales",
                                "xAxis": "Time.Month",
                                "chartType": "lineChart"
                            }
                        })
                    }
                }],
                usage: { total_tokens: 200, prompt_tokens: 150, completion_tokens: 50 }
            };

            const mockFetch = require('node-fetch');
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockApiResponse)
            });

            const result = await recordPerformance('Chart Creation - Sales by Month', async () => {
                return await openaiService.processChat(
                    'show me sales by month',
                    mockMetadata,
                    null,
                    null,
                    { req: {}, res: {} }
                );
            });

            expect(result.success).toBe(true);
        });

        test('Performance: "sales by district as a bar chart" response time', async () => {
            const mockApiResponse = {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            "chatResponse": "I'll create a bar chart showing sales by district!",
                            "chartAction": {
                                "yAxis": "District.District",
                                "xAxis": "Sales.TotalSales",
                                "chartType": "barChart"
                            }
                        })
                    }
                }],
                usage: { total_tokens: 190, prompt_tokens: 140, completion_tokens: 50 }
            };

            const mockFetch = require('node-fetch');
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockApiResponse)
            });

            const result = await recordPerformance('Chart Creation - Bar Chart', async () => {
                return await openaiService.processChat(
                    'sales by district as a bar chart',
                    mockMetadata,
                    null,
                    null,
                    { req: {}, res: {} }
                );
            });

            expect(result.success).toBe(true);
        });
    });

    describe('Context Update Performance', () => {
        test('Performance: "change it to a bar chart" with context', async () => {
            const currentChart = {
                yAxis: 'Sales.TotalSales',
                xAxis: 'Time.Month',
                chartType: 'lineChart'
            };

            const mockApiResponse = {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            "chatResponse": "I'll change it to a bar chart!",
                            "chartAction": {
                                "yAxis": "Time.Month",
                                "xAxis": "Sales.TotalSales",
                                "chartType": "barChart"
                            }
                        })
                    }
                }],
                usage: { total_tokens: 220, prompt_tokens: 170, completion_tokens: 50 }
            };

            const mockFetch = require('node-fetch');
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockApiResponse)
            });

            const result = await recordPerformance('Context Update - Chart Type Change', async () => {
                return await openaiService.processChat(
                    'change it to a bar chart',
                    mockMetadata,
                    currentChart,
                    null,
                    { req: {}, res: {} }
                );
            });

            expect(result.success).toBe(true);
        });
    });
});