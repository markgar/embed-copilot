const request = require('supertest');

/**
 * OpenAI Service Baseline Snapshot Tests
 * These tests capture the exact responses for regression detection
 */
describe('OpenAI Service - Baseline Response Snapshots', () => {
    let app;

    beforeAll(() => {
        process.env.NODE_ENV = 'test';
        app = require('../../src-v2/app.js');
    });

    // Helper to extract and parse response
    const getResponseData = async (message, additionalParams = {}) => {
        const response = await request(app)
            .post('/chat')
            .send({ message, ...additionalParams });

        if (response.status !== 200) {
            throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`);
        }

        const parsedResponse = JSON.parse(response.body.response);
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

            expect(data.chatResponse).toContain('field');
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

            expect(data.chatResponse).toBeDefined();
            expect(data.chartAction).toBeDefined();
            expect(data.chartAction.yAxis).toBeDefined();
            expect(data.chartAction.xAxis).toBeDefined();
            expect(data.chartAction.chartType).toBeDefined();

            // Verify proper axis assignment (measure on Y, time dimension on X)
            expect(data.chartAction.yAxis).toContain('Sales');
            expect(data.chartAction.xAxis).toContain('Month');
            // AI chooses lineChart for time-based data (Month) - this is correct per prompt engineering
            expect(['columnChart', 'lineChart']).toContain(data.chartAction.chartType);

            console.log('\n=== BASELINE CAPTURED ===');
            console.log('Query: "show me sales by month"');
            console.log('Response Type: Chart Creation');
            console.log('Chart Action:', JSON.stringify(data.chartAction, null, 2));
            console.log('Chat Response:', data.chatResponse);
            console.log('Note: AI chose', data.chartAction.chartType, 'for time-based dimension (Month)');
        });

        test('SNAPSHOT: "sales by district" response format', async () => {
            const data = await getResponseData('sales by district');

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
            expect(data.chatResponse.toLowerCase()).toContain('which');
            expect(data.chartAction).toBeUndefined(); // Should not create chart for ambiguous request

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

            // Should create column chart with TotalUnits by District
            expect(data.chartAction).toBeDefined();
            expect(data.chartAction.yAxis).toBe('Sales.TotalUnits');
            expect(data.chartAction.xAxis).toBe('District.District');
            expect(data.chartAction.chartType).toBe('columnChart');
            expect(data.chatResponse).toBe("I'll create a column chart showing TotalUnits by District!");
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
            // First prompt: establish baseline chart
            const data1 = await getResponseData('show me sales by month');

            // Validate first response
            expect(data1.chartAction).toBeDefined();
            expect(data1.chartAction.yAxis).toBe('Sales.TotalSales');
            expect(data1.chartAction.xAxis).toBe('Time.Month');
            expect(data1.chartAction.chartType).toBe('lineChart');
            expect(data1.chatResponse).toBe("I'll create a line chart showing TotalSales by Month!");
            expect(data1.hasUsage).toBe(true);

            // Second prompt: context-aware chart modification
            const chatHistory = [
                { role: 'user', content: 'show me sales by month' },
                { role: 'assistant', content: data1.chatResponse }
            ];

            const data2 = await getResponseData('Change that to a column chart', {
                currentChart: data1.chartAction,
                chatHistory: chatHistory
            });

            // Validate second response maintains same data fields but changes chart type
            expect(data2.chartAction).toBeDefined();
            expect(data2.chartAction.yAxis).toBe('Sales.TotalSales'); // Same as first
            expect(data2.chartAction.xAxis).toBe('Time.Month'); // Same as first
            expect(data2.chartAction.chartType).toBe('columnChart'); // Changed
            expect(data2.chatResponse).toBe("I'll change it to a column chart showing TotalSales by Month!");
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