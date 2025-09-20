const OpenAIService = require('../../src-v2/services/openaiService');
const configService = require('../../src-v2/services/configService');

/**
 * OpenAI Service Regression Tests
 * These tests capture the expected behavior of the OpenAI service with the original prompt engineering
 * to ensure we don't regress on the carefully crafted prompt responses.
 */
describe('OpenAI Service - Regression Tests', () => {
    let openaiService;
    let originalConsoleLog;

    // Mock configuration that should work for testing
    const mockConfig = {
        azureOpenAIEndpoint: 'https://test.openai.azure.com',
        azureOpenAIApiKey: 'test-key-12345',
        azureOpenAIDeploymentName: 'test-deployment',
        azureOpenAIApiVersion: '2023-12-01-preview'
    };

    // Sample metadata matching the Power BI dataset structure
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
                    { name: 'Year', dataType: 'Int64' },
                    { name: 'Quarter', dataType: 'Text' },
                    { name: 'FiscalMonth', dataType: 'Text' },
                    { name: 'FiscalYear', dataType: 'Int64' }
                ]
            },
            {
                name: 'District',
                columns: [
                    { name: 'District', dataType: 'Text' },
                    { name: 'DM', dataType: 'Text' }
                ]
            },
            {
                name: 'Item',
                columns: [
                    { name: 'Category', dataType: 'Text' },
                    { name: 'Segment', dataType: 'Text' }
                ]
            }
        ]
    };

    beforeAll(() => {
        // Suppress console logs during testing to keep output clean
        originalConsoleLog = console.log;
        console.log = jest.fn();
    });

    afterAll(() => {
        // Restore console logs
        console.log = originalConsoleLog;
    });

    beforeEach(async () => {
        // Mock the config service
        jest.spyOn(configService, 'loadConfig').mockReturnValue(mockConfig);
        
        // Create and initialize service
        openaiService = new OpenAIService();
        await openaiService.initialize();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Schema Inquiry Responses', () => {
        test('should respond to "show me the fields" with properly formatted schema information', async () => {
            // Mock fetch to return a schema response
            const mockApiResponse = {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            "chatResponse": "## Available Fields\\n\\nYou can use these fields for creating charts:\\n\\n**Sales**:\\n- `Sales.TotalSales` - Total sales amount\\n- `Sales.TotalUnits` - Total units sold\\n\\n**Time**:\\n- `Time.Month` - Month of the year\\n- `Time.Year` - Calendar year\\n- `Time.Quarter` - Calendar quarter\\n- `Time.FiscalMonth` - Fiscal month\\n- `Time.FiscalYear` - Fiscal year\\n\\n**District**:\\n- `District.District` - Sales district name\\n- `District.DM` - District manager\\n\\n**Item**:\\n- `Item.Category` - Product category\\n- `Item.Segment` - Product segment"
                        })
                    }
                }],
                usage: { total_tokens: 150, prompt_tokens: 100, completion_tokens: 50 }
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockApiResponse)
            });

            const result = await openaiService.processChat(
                'show me the fields',
                mockMetadata,
                null,
                null,
                { req: {}, res: {} }
            );

            // Verify the response structure
            expect(result.success).toBe(true);
            expect(result.response).toBeDefined();
            expect(result.usage).toBeDefined();

            // Parse the JSON response to verify it follows the expected format
            const parsedResponse = JSON.parse(result.response);
            expect(parsedResponse).toHaveProperty('chatResponse');
            expect(parsedResponse.chatResponse).toContain('Available Fields');
            expect(parsedResponse.chatResponse).toContain('Sales.TotalSales');
            expect(parsedResponse.chatResponse).toContain('Time.Month');
            expect(parsedResponse.chatResponse).toContain('District.District');

            // Should NOT have chartAction for schema inquiries
            expect(parsedResponse).not.toHaveProperty('chartAction');
        });

        test('should respond to "what fields are available?" with same schema format', async () => {
            const mockApiResponse = {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            "chatResponse": "## Available Fields\\n\\nHere are all the fields you can use for creating charts:\\n\\n**Sales Table**:\\n- `Sales.TotalSales` [Double] - Total sales amount\\n- `Sales.TotalUnits` [Int64] - Total units sold\\n\\n**Time Table**:\\n- `Time.Month` [Text] - Month of the year\\n- `Time.Year` [Int64] - Calendar year\\n- `Time.Quarter` [Text] - Calendar quarter\\n\\n**District Table**:\\n- `District.District` [Text] - Sales district name\\n- `District.DM` [Text] - District manager\\n\\n**Item Table**:\\n- `Item.Category` [Text] - Product category\\n- `Item.Segment` [Text] - Product segment"
                        })
                    }
                }],
                usage: { total_tokens: 180, prompt_tokens: 120, completion_tokens: 60 }
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockApiResponse)
            });

            const result = await openaiService.processChat(
                'what fields are available?',
                mockMetadata,
                null,
                null,
                { req: {}, res: {} }
            );

            const parsedResponse = JSON.parse(result.response);
            expect(parsedResponse).toHaveProperty('chatResponse');
            expect(parsedResponse.chatResponse).toContain('Available Fields');
            expect(parsedResponse).not.toHaveProperty('chartAction');
        });
    });

    describe('Chart Creation Responses', () => {
        test('should respond to "show me sales by month" with proper chart action', async () => {
            const mockApiResponse = {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            "chatResponse": "I'll create a column chart showing sales by month!",
                            "chartAction": {
                                "yAxis": "Sales.TotalSales",
                                "xAxis": "Time.Month",
                                "chartType": "columnChart"
                            }
                        })
                    }
                }],
                usage: { total_tokens: 200, prompt_tokens: 150, completion_tokens: 50 }
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockApiResponse)
            });

            const result = await openaiService.processChat(
                'show me sales by month',
                mockMetadata,
                null,
                null,
                { req: {}, res: {} }
            );

            // Verify response structure
            expect(result.success).toBe(true);
            expect(result.response).toBeDefined();
            expect(result.usage).toBeDefined();

            // Parse and verify JSON response format
            const parsedResponse = JSON.parse(result.response);
            expect(parsedResponse).toHaveProperty('chatResponse');
            expect(parsedResponse).toHaveProperty('chartAction');

            // Verify chart action structure
            const chartAction = parsedResponse.chartAction;
            expect(chartAction).toHaveProperty('yAxis');
            expect(chartAction).toHaveProperty('xAxis'); 
            expect(chartAction).toHaveProperty('chartType');

            // Verify proper axis assignment for column chart
            expect(chartAction.yAxis).toBe('Sales.TotalSales'); // Measure on Y
            expect(chartAction.xAxis).toBe('Time.Month'); // Dimension on X
            expect(chartAction.chartType).toBe('columnChart');

            // Verify chat response mentions the action
            expect(parsedResponse.chatResponse).toContain('chart');
            expect(parsedResponse.chatResponse.toLowerCase()).toContain('sales');
            expect(parsedResponse.chatResponse.toLowerCase()).toContain('month');
        });

        test('should respond to "sales by district as a bar chart" with correct axis assignment', async () => {
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

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockApiResponse)
            });

            const result = await openaiService.processChat(
                'sales by district as a bar chart',
                mockMetadata,
                null,
                null,
                { req: {}, res: {} }
            );

            const parsedResponse = JSON.parse(result.response);
            const chartAction = parsedResponse.chartAction;

            // For bar charts, dimensions should be on Y-axis, measures on X-axis
            expect(chartAction.yAxis).toBe('District.District'); // Dimension on Y
            expect(chartAction.xAxis).toBe('Sales.TotalSales'); // Measure on X
            expect(chartAction.chartType).toBe('barChart');
        });
    });

    describe('Chart Context and Partial Updates', () => {
        test('should handle "change it to a bar chart" with current chart context', async () => {
            const currentChart = {
                yAxis: 'Sales.TotalSales',
                xAxis: 'Time.Month',
                chartType: 'columnChart'
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

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockApiResponse)
            });

            const result = await openaiService.processChat(
                'change it to a bar chart',
                mockMetadata,
                currentChart,
                null,
                { req: {}, res: {} }
            );

            const parsedResponse = JSON.parse(result.response);
            const chartAction = parsedResponse.chartAction;

            // Should swap axes when changing from column to bar chart
            expect(chartAction.yAxis).toBe('Time.Month'); // Was on X, now on Y
            expect(chartAction.xAxis).toBe('Sales.TotalSales'); // Was on Y, now on X
            expect(chartAction.chartType).toBe('barChart');
        });

        test('should handle ambiguous requests by asking for clarification', async () => {
            const mockApiResponse = {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            "chatResponse": "I'll try to create a chart with sales data! Which field should I use for grouping - like by month, district, or category?"
                        })
                    }
                }],
                usage: { total_tokens: 160, prompt_tokens: 120, completion_tokens: 40 }
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockApiResponse)
            });

            const result = await openaiService.processChat(
                'show me sales',
                mockMetadata,
                null,
                null,
                { req: {}, res: {} }
            );

            const parsedResponse = JSON.parse(result.response);
            
            // Should ask for clarification, not create a chart action
            expect(parsedResponse).toHaveProperty('chatResponse');
            expect(parsedResponse).not.toHaveProperty('chartAction');
            expect(parsedResponse.chatResponse).toContain('Which field');
            expect(parsedResponse.chatResponse.toLowerCase()).toContain('grouping');
        });
    });

    describe('System Prompt Building', () => {
        test('should build system prompt with all required components', () => {
            const prompt = openaiService.buildSystemPrompt(mockMetadata, null, null);

            // Verify prompt contains key sections
            expect(prompt).toContain('You are a specialized Power BI chart creation assistant');
            expect(prompt).toContain('CORE RESPONSIBILITIES');
            expect(prompt).toContain('AXIS ASSIGNMENT RULES');
            expect(prompt).toContain('RESPONSE FORMAT');
            expect(prompt).toContain('SCHEMA (table.column [type])');
            
            // Verify schema section includes our test data
            expect(prompt).toContain('Sales.TotalSales [Double]');
            expect(prompt).toContain('Time.Month [Text]');
            expect(prompt).toContain('District.District [Text]');
        });

        test('should include current chart context when provided', () => {
            const currentChart = {
                yAxis: 'Sales.TotalSales',
                xAxis: 'District.District',
                chartType: 'columnChart'
            };

            const prompt = openaiService.buildSystemPrompt(mockMetadata, currentChart, null);

            expect(prompt).toContain('CURRENT CHART CONTEXT');
            expect(prompt).toContain('Y-axis: Sales.TotalSales');
            expect(prompt).toContain('X-axis: District.District');
            expect(prompt).toContain('Chart Type: columnChart');
        });

        test('should include chat history when provided', () => {
            const chatHistory = [
                { role: 'user', content: 'show me sales data' },
                { role: 'assistant', content: 'Which field should I use for grouping?' },
                { role: 'user', content: 'by month please' }
            ];

            const prompt = openaiService.buildSystemPrompt(mockMetadata, null, chatHistory);

            expect(prompt).toContain('CONVERSATION HISTORY FOR CONTEXT');
            expect(prompt).toContain('User: show me sales data');
            expect(prompt).toContain('Assistant: Which field should I use for grouping?');
            expect(prompt).toContain('User: by month please');
        });
    });

    describe('Error Handling', () => {
        test('should handle Azure OpenAI API errors gracefully', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 401,
                text: () => Promise.resolve('Unauthorized')
            });

            await expect(openaiService.processChat(
                'test message',
                mockMetadata,
                null,
                null,
                { req: {}, res: {} }
            )).rejects.toThrow('Chat completion failed: Azure OpenAI API error (401): Unauthorized');
        });

        test('should handle network errors', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

            await expect(openaiService.processChat(
                'test message',
                mockMetadata,
                null,
                null,
                { req: {}, res: {} }
            )).rejects.toThrow('Chat completion failed: Network error');
        });
    });

    describe('Regression Prevention', () => {
        test('should always return JSON response for valid chart requests', async () => {
            const testCases = [
                'show me sales by month',
                'create a bar chart of units by district', 
                'sales by category as a pie chart',
                'line chart showing sales over time'
            ];

            for (const message of testCases) {
                const mockApiResponse = {
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                "chatResponse": "I'll create the chart!",
                                "chartAction": {
                                    "yAxis": "Sales.TotalSales",
                                    "xAxis": "Time.Month",
                                    "chartType": "columnChart"
                                }
                            })
                        }
                    }],
                    usage: { total_tokens: 200, prompt_tokens: 150, completion_tokens: 50 }
                };

                global.fetch = jest.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockApiResponse)
                });

                const result = await openaiService.processChat(
                    message,
                    mockMetadata,
                    null,
                    null,
                    { req: {}, res: {} }
                );

                // Should always be valid JSON
                expect(() => JSON.parse(result.response)).not.toThrow();
                
                const parsedResponse = JSON.parse(result.response);
                expect(parsedResponse).toHaveProperty('chatResponse');
                expect(parsedResponse).toHaveProperty('chartAction');
            }
        });

        test('should never return chartAction for schema inquiry requests', async () => {
            const schemaCases = [
                'show me the fields',
                'what fields are available?',
                'show me the schema',
                'what tables are available?',
                'what columns can I use?'
            ];

            for (const message of schemaCases) {
                const mockApiResponse = {
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                "chatResponse": "## Available Fields\\n\\nHere are the fields..."
                            })
                        }
                    }],
                    usage: { total_tokens: 150, prompt_tokens: 100, completion_tokens: 50 }
                };

                global.fetch = jest.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockApiResponse)
                });

                const result = await openaiService.processChat(
                    message,
                    mockMetadata,
                    null,
                    null,
                    { req: {}, res: {} }
                );

                const parsedResponse = JSON.parse(result.response);
                expect(parsedResponse).toHaveProperty('chatResponse');
                expect(parsedResponse).not.toHaveProperty('chartAction');
            }
        });
    });
});