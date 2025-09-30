const request = require('supertest');
const OpenAIService = require('../../src-v2/services/openaiService');

/**
 * OpenAI Service Baseline Snapshot Tests
 * These tests capture the exact responses for regression detection
 */
describe('OpenAI Service - Baseline Response Snapshots', () => {
    let app;
    let openaiService;

    beforeAll(() => {
        process.env.NODE_ENV = 'test';
        app = require('../../src-v2/app.js');
    });

    beforeEach(async () => {
        // Create a fresh OpenAI service instance for each test
        openaiService = new OpenAIService();
        
        // Initialize the service
        if (!openaiService.initialized) {
            await openaiService.initialize();
        }
        
        // Clear any potential state that could affect test isolation
        console.log('[Test Setup] OpenAI service initialized:', openaiService.initialized);
    });

    // Helper to add delay between API calls to avoid rate limiting
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Helper to check if test should be skipped due to rate limiting
    const skipIfRateLimited = (data, testName) => {
        if (!data) {
            console.log(`⏭️  Test "${testName}" skipped due to PowerBI API rate limiting`);
            return true;
        }
        return false;
    };

    // Helper to extract and parse response
    const getResponseData = async (message, additionalParams = {}) => {
        const response = await request(app)
            .post('/chat')
            .send({ 
                message, 
                chatHistory: [], // Include empty chat history like the frontend does
                ...additionalParams 
            });

        // Handle PowerBI API rate limiting (429) gracefully
        if (response.status === 500 && response.body && response.body.error && 
            response.body.details && response.body.details.includes('429')) {
            console.warn(`⚠️  PowerBI API rate limiting detected for "${message}". Skipping test.`);
            console.warn(`   Details: ${response.body.details}`);
            return null; // Return null to indicate rate limiting
        }

        if (response.status !== 200) {
            throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`);
        }

        const parsedResponse = JSON.parse(response.body.response);
        
        // Add delay to avoid PowerBI API rate limiting
        // PowerBI throttling shows "Retry in 60 seconds", so we use conservative 5-second delays
        await delay(5000); // 5 second delay between calls
        
        return {
            status: response.status,
            chatResponse: parsedResponse.chatResponse,
            chartAction: parsedResponse.chartAction,
            hasUsage: !!response.body.usage
        };
    };

    describe('Schema Inquiry Snapshots', () => {
        test('SNAPSHOT: "show me the fields" response format', async () => {
            const data = await getResponseData('show me the fields');
            if (skipIfRateLimited(data, 'show me the fields')) return;

            // Capture the baseline structure
            expect(data.chatResponse).toContain('Available Fields');
            expect(data.chatResponse).toContain('Sales.TotalSales');
            expect(data.chatResponse).toContain('Time.Month');
            expect(data.chatResponse).toContain('District.District');
            expect(data.chartAction).toBeUndefined();
            expect(data.hasUsage).toBe(true);

            // Log the exact response for manual verification
            console.log('\n=== BASELINE CAPTURED ===');
            console.log('Query: "show me the fields"');
            console.log('Response Type: Schema Information');
            console.log('Has Chart Action: No');
            console.log('Response Length:', data.chatResponse.length);
            console.log('Contains Required Fields: Yes');
        });

        test('SNAPSHOT: "what fields are available?" response format', async () => {
            const data = await getResponseData('what fields are available?');
            if (skipIfRateLimited(data, 'what fields are available?')) return;

            expect(data.chatResponse.toLowerCase()).toContain('field');
            expect(data.chartAction).toBeUndefined();
            expect(data.hasUsage).toBe(true);

            console.log('\n=== BASELINE CAPTURED ===');
            console.log('Query: "what fields are available?"');
            console.log('Response Type: Schema Information');
            console.log('Has Chart Action: No');
        });
    });

    describe('Chart Creation Snapshots', () => {
        test('SNAPSHOT: "show me sales by month" response format', async () => {
            const data = await getResponseData('show me sales by month');
            if (skipIfRateLimited(data, 'show me sales by month')) return;

            expect(data.chatResponse).toBeDefined();
            expect(data.chartAction).toBeDefined();
            expect(data.chartAction.yAxis).toBeDefined();
            expect(data.chartAction.xAxis).toBeDefined();
            expect(data.chartAction.chartType).toBeDefined();

            // STRICT: Verify proper axis assignment (measure on Y, time dimension on X)
            expect(data.chartAction.yAxis).toContain('Sales');
            expect(data.chartAction.xAxis).toContain('Month');
            // STRICT: AI should choose lineChart for time-based data (Month)
            expect(data.chartAction.chartType).toBe('lineChart');
            // FLEXIBLE: Chat response can vary but should mention the chart creation
            expect(data.chatResponse).toMatch(/line chart|chart/i);

            console.log('\n=== BASELINE CAPTURED ===');
            console.log('Query: "show me sales by month"');
            console.log('Response Type: Chart Creation');
            console.log('Chart Action:', JSON.stringify(data.chartAction, null, 2));
            console.log('Chat Response:', data.chatResponse);
            console.log('Note: AI chose', data.chartAction.chartType, 'for time-based dimension (Month)');
        });

        test('SNAPSHOT: "sales by district" response format', async () => {
            const data = await getResponseData('sales by district');
            if (skipIfRateLimited(data, 'sales by district')) return;

            expect(data.chartAction).toBeDefined();
            expect(data.chartAction.yAxis).toContain('Sales');
            expect(data.chartAction.xAxis).toContain('District');
            expect(data.chartAction.chartType).toBe('columnChart');

            console.log('\n=== BASELINE CAPTURED ===');
            console.log('Query: "sales by district"');
            console.log('Chart Action:', JSON.stringify(data.chartAction, null, 2));
        });

        test('SNAPSHOT: "bar chart of sales by district" response format', async () => {
            const data = await getResponseData('bar chart of sales by district');
            if (skipIfRateLimited(data, 'bar chart of sales by district')) return;

            expect(data.chartAction).toBeDefined();
            expect(data.chartAction.chartType).toBe('barChart');
            
            // For bar charts, dimensions should be on Y-axis, measures on X-axis
            expect(data.chartAction.yAxis).toContain('District');
            expect(data.chartAction.xAxis).toContain('Sales');

            console.log('\n=== BASELINE CAPTURED ===');
            console.log('Query: "bar chart of sales by district"');
            console.log('Chart Action:', JSON.stringify(data.chartAction, null, 2));
            console.log('Note: Proper axis assignment for bar chart (dimension on Y, measure on X)');
        });

        test('SNAPSHOT: "show me sales by month by district" response format', async () => {
            const data = await getResponseData('show me sales by month by district');
            if (skipIfRateLimited(data, 'show me sales by month by district')) return;

            expect(data.chatResponse).toBeDefined();
            expect(data.chartAction).toBeDefined();
            expect(data.chartAction.yAxis).toBeDefined();
            expect(data.chartAction.xAxis).toBeDefined();
            expect(data.chartAction.chartType).toBeDefined();

            // STRICT: Verify proper axis assignment for multi-dimensional data
            expect(data.chartAction.yAxis).toContain('Sales');
            expect(data.chartAction.xAxis).toContain('Month');
            expect(data.chartAction.series).toContain('District');
            // STRICT: AI should choose clusteredColumnChart for time series with grouping dimension
            expect(data.chartAction.chartType).toBe('clusteredColumnChart');
            // FLEXIBLE: Chat response can vary but should mention the chart creation
            expect(data.chatResponse).toMatch(/clustered column chart|chart/i);

            console.log('\n=== BASELINE CAPTURED ===');
            console.log('Query: "show me sales by month by district"');
            console.log('Response Type: Chart Creation');
            console.log('Chart Action:', JSON.stringify(data.chartAction, null, 2));
            console.log('Chat Response:', data.chatResponse);
            console.log('Note: AI chose', data.chartAction.chartType, 'for time-based dimension (Month) with grouping (District)');
        });
    });

    describe('Context-Aware Snapshots', () => {
        test('SNAPSHOT: "change it to a bar chart" with current chart context', async () => {
            const currentChart = {
                yAxis: 'Sales.TotalSales',
                xAxis: 'District.District',
                chartType: 'columnChart'
            };

            const data = await getResponseData('change it to a bar chart', { currentChart });

            expect(data.chartAction).toBeDefined();
            expect(data.chartAction.chartType).toBe('barChart');
            
            // Should swap axes when changing from column to bar
            expect(data.chartAction.yAxis).toBe('District.District');
            expect(data.chartAction.xAxis).toBe('Sales.TotalSales');

            console.log('\n=== BASELINE CAPTURED ===');
            console.log('Query: "change it to a bar chart"');
            console.log('Original Chart:', JSON.stringify(currentChart, null, 2));
            console.log('New Chart:', JSON.stringify(data.chartAction, null, 2));
            console.log('Note: Axes correctly swapped for column→bar conversion');
        });

        test('SNAPSHOT: "change it to a line chart" maintaining axes for compatible chart type', async () => {
            const currentChart = {
                yAxis: 'Sales.TotalSales',
                xAxis: 'Time.Month',
                chartType: 'columnChart'
            };

            const data = await getResponseData('change it to a line chart', { currentChart });

            expect(data.chartAction).toBeDefined();
            expect(data.chartAction.chartType).toBe('lineChart');
            
            // Line charts keep same axis assignment as column charts
            expect(data.chartAction.yAxis).toBe('Sales.TotalSales');
            expect(data.chartAction.xAxis).toBe('Time.Month');

            console.log('\n=== BASELINE CAPTURED ===');
            console.log('Query: "change it to a line chart"');
            console.log('Original Chart:', JSON.stringify(currentChart, null, 2));
            console.log('New Chart:', JSON.stringify(data.chartAction, null, 2));
            console.log('Note: Axes maintained for column→line (compatible types)');
        });
    });

    describe('Edge Case Snapshots', () => {
        test('SNAPSHOT: Ambiguous request should ask for clarification', async () => {
            const data = await getResponseData('show me sales');

            expect(data.chatResponse).toBeDefined();
            expect(data.chartAction).toBeFalsy(); // Should not create chart for ambiguous request (accepts null or undefined)

            console.log('\n=== BASELINE CAPTURED ===');
            console.log('Query: "show me sales" (ambiguous)');
            console.log('Response Type: Clarification Request');
            console.log('Has Chart Action: No');
            console.log('Response:', data.chatResponse);
        });

        test('SNAPSHOT: Request with chat history context', async () => {
            const chatHistory = [
                { role: 'user', content: 'show me sales data' },
                { role: 'assistant', content: 'Which field should I use for grouping - like by month, district, or category?' },
                { role: 'user', content: 'by month please' }
            ];

            const data = await getResponseData('by month please', { chatHistory });

            // Should understand context and create chart
            expect(data.chartAction).toBeDefined();
            expect(data.chartAction.xAxis).toContain('Month');
            expect(data.chartAction.yAxis).toContain('Sales');

            console.log('\n=== BASELINE CAPTURED ===');
            console.log('Query: "by month please" (with chat history context)');
            console.log('Chart Action:', JSON.stringify(data.chartAction, null, 2));
            console.log('Note: Successfully interpreted context from chat history');
        });

        test('SNAPSHOT: "show me units by district" chart creation', async () => {
            const data = await getResponseData('show me units by district');

            // STRICT: Chart definition must be correct
            expect(data.chartAction).toBeDefined();
            expect(data.chartAction.yAxis).toBe('Sales.TotalUnits');
            expect(data.chartAction.xAxis).toBe('District.District');
            expect(data.chartAction.chartType).toBe('columnChart');
            // FLEXIBLE: Chat response can vary but should mention units and district
            expect(data.chatResponse).toMatch(/units.*district|district.*units/i);
            expect(data.hasUsage).toBe(true);

            console.log('\n=== BASELINE CAPTURED ===');
            console.log('Query: "show me units by district"');
            console.log('Chart Action:', JSON.stringify(data.chartAction, null, 2));
            console.log('Response:', data.chatResponse);
            console.log('Note: Correctly uses TotalUnits instead of TotalSales');
        });
    });

    describe('Multi-Turn Context Snapshots', () => {
        test('SNAPSHOT: Two-prompt sequence - "show me sales by month" then "Change that to a column chart"', async () => {
            // STEP 1: First prompt with empty chat history (simulating fresh session)
            console.log('\n=== STEP 1: First prompt (empty history) ===');
            const data1 = await getResponseData('show me sales by month');
            console.log('First response chart type:', data1.chartAction.chartType);
            console.log('First response text:', data1.chatResponse);

            // Validate first response - STRICT on chart definition, FLEXIBLE on text
            expect(data1.chartAction).toBeDefined();
            expect(data1.chartAction.yAxis).toBe('Sales.TotalSales');
            expect(data1.chartAction.xAxis).toBe('Time.Month');
            expect(data1.chartAction.chartType).toBe('lineChart');
            expect(data1.chatResponse).toMatch(/line chart|chart/i); // Flexible text
            expect(data1.hasUsage).toBe(true);

            // STEP 2: Build chat history exactly as frontend does
            console.log('\n=== STEP 2: Building chat history ===');
            const chatHistory = [
                { role: 'user', content: 'show me sales by month' },
                { role: 'assistant', content: data1.chatResponse }
            ];
            console.log('Chat history for second call:', JSON.stringify(chatHistory, null, 2));

            // STEP 3: Second prompt with context (simulating follow-up in same session)
            console.log('\n=== STEP 3: Second prompt (with history & currentChart) ===');
            const data2 = await getResponseData('Change that to a column chart', {
                currentChart: data1.chartAction,
                chatHistory: chatHistory
            });
            console.log('Second response chart type:', data2.chartAction.chartType);
            console.log('Second response text:', data2.chatResponse);

            // Validate second response - STRICT on chart definition, FLEXIBLE on text
            expect(data2.chartAction).toBeDefined();
            expect(data2.chartAction.yAxis).toBe('Sales.TotalSales'); // Same as first
            expect(data2.chartAction.xAxis).toBe('Time.Month'); // Same as first
            expect(data2.chartAction.chartType).toBe('columnChart'); // Changed
            expect(data2.chatResponse).toMatch(/column chart|chart/i); // Flexible text
            expect(data2.hasUsage).toBe(true);

            console.log('\n=== BASELINE CAPTURED ===');
            console.log('Two-prompt sequence test:');
            console.log('First prompt: "show me sales by month"');
            console.log('First chart:', JSON.stringify(data1.chartAction, null, 2));
            console.log('Second prompt: "Change that to a column chart"');
            console.log('Second chart:', JSON.stringify(data2.chartAction, null, 2));
            console.log('Note: Context maintained - same axes, chart type changed correctly');
        });
    });
});