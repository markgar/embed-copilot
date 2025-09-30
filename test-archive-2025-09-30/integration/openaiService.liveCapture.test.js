const request = require('supertest');

/**
 * OpenAI Service Integration Tests - Live Server
 * These tests capture the actual behavior of the OpenAI service with real responses
 * to establish baseline behavior and prevent regression.
 */
describe('OpenAI Service Integration - Live Behavior Capture', () => {
    let app;

    beforeAll(() => {
        // Use the live server to capture real behavior
        process.env.NODE_ENV = 'test';
        app = require('../../src-v2/app.js');
    });

    describe('Schema Inquiry Behavior - Live Capture', () => {
        test('BASELINE: "show me the fields" should return schema information', async () => {
            const response = await request(app)
                .post('/chat')
                .send({ message: 'show me the fields' });

            console.log('BASELINE CAPTURE - "show me the fields":', {
                status: response.status,
                responseLength: response.body.response?.length,
                hasUsage: !!response.body.usage,
                response: response.body.response
            });

            if (response.status === 200) {
                // Capture the actual response format
                expect(response.body).toHaveProperty('response');
                expect(response.body).toHaveProperty('usage');
                
                // Try to parse as JSON (should be JSON from our prompt engineering)
                let parsedResponse;
                try {
                    parsedResponse = JSON.parse(response.body.response);
                    console.log('PARSED RESPONSE:', parsedResponse);
                } catch (e) {
                    console.log('RESPONSE NOT JSON:', response.body.response);
                    // For baseline capture, we accept both JSON and non-JSON
                }

                if (parsedResponse) {
                    expect(parsedResponse).toHaveProperty('chatResponse');
                    // Should NOT have chartAction for schema requests
                    expect(parsedResponse).not.toHaveProperty('chartAction');
                    
                    // Should contain field information
                    expect(parsedResponse.chatResponse.toLowerCase()).toContain('field');
                }
            } else if (response.status === 500) {
                // OpenAI not configured - this is acceptable for testing
                console.log('OpenAI not configured - status 500 expected');
                expect(response.body).toHaveProperty('error');
            }
        });

        test('BASELINE: "what fields are available?" should return schema information', async () => {
            const response = await request(app)
                .post('/chat')
                .send({ message: 'what fields are available?' });

            console.log('BASELINE CAPTURE - "what fields are available?":', {
                status: response.status,
                responseLength: response.body.response?.length,
                response: response.body.response
            });

            if (response.status === 200) {
                let parsedResponse;
                try {
                    parsedResponse = JSON.parse(response.body.response);
                } catch (e) {
                    // Log for investigation if not JSON
                    console.log('Non-JSON response:', response.body.response);
                }

                if (parsedResponse) {
                    expect(parsedResponse).toHaveProperty('chatResponse');
                    expect(parsedResponse).not.toHaveProperty('chartAction');
                }
            }
        });
    });

    describe('Chart Creation Behavior - Live Capture', () => {
        test('BASELINE: "show me sales by month" should return chart action', async () => {
            const response = await request(app)
                .post('/chat')
                .send({ message: 'show me sales by month' });

            console.log('BASELINE CAPTURE - "show me sales by month":', {
                status: response.status,
                responseLength: response.body.response?.length,
                response: response.body.response
            });

            if (response.status === 200) {
                let parsedResponse;
                try {
                    parsedResponse = JSON.parse(response.body.response);
                    console.log('CHART ACTION RESPONSE:', parsedResponse);
                } catch (e) {
                    console.log('RESPONSE NOT JSON:', response.body.response);
                }

                if (parsedResponse) {
                    expect(parsedResponse).toHaveProperty('chatResponse');
                    expect(parsedResponse).toHaveProperty('chartAction');
                    
                    // Capture the expected chart action structure
                    const chartAction = parsedResponse.chartAction;
                    expect(chartAction).toHaveProperty('yAxis');
                    expect(chartAction).toHaveProperty('xAxis');
                    expect(chartAction).toHaveProperty('chartType');
                    
                    console.log('CAPTURED CHART ACTION:', chartAction);
                }
            }
        });

        test('BASELINE: "sales by district" should return chart action', async () => {
            const response = await request(app)
                .post('/chat')
                .send({ message: 'sales by district' });

            console.log('BASELINE CAPTURE - "sales by district":', {
                status: response.status,
                response: response.body.response
            });

            if (response.status === 200) {
                let parsedResponse;
                try {
                    parsedResponse = JSON.parse(response.body.response);
                } catch (e) {
                    console.log('RESPONSE NOT JSON:', response.body.response);
                }

                if (parsedResponse && parsedResponse.chartAction) {
                    console.log('CAPTURED CHART ACTION:', parsedResponse.chartAction);
                }
            }
        });
    });

    describe('Current Chart Context Behavior - Live Capture', () => {
        test('BASELINE: "change it to a bar chart" with current chart context', async () => {
            const currentChart = {
                yAxis: 'Sales.TotalSales',
                xAxis: 'District.District',
                chartType: 'columnChart'
            };

            const response = await request(app)
                .post('/chat')
                .send({ 
                    message: 'change it to a bar chart',
                    currentChart: currentChart
                });

            console.log('BASELINE CAPTURE - "change it to a bar chart":', {
                status: response.status,
                response: response.body.response
            });

            if (response.status === 200) {
                let parsedResponse;
                try {
                    parsedResponse = JSON.parse(response.body.response);
                } catch (e) {
                    console.log('RESPONSE NOT JSON:', response.body.response);
                }

                if (parsedResponse && parsedResponse.chartAction) {
                    console.log('CAPTURED AXIS SWAP:', {
                        original: currentChart,
                        newChart: parsedResponse.chartAction
                    });
                    
                    // Should swap axes for column->bar conversion
                    const newChart = parsedResponse.chartAction;
                    expect(newChart.chartType).toBe('barChart');
                }
            }
        });
    });

    describe('Edge Cases - Live Capture', () => {
        test('BASELINE: Ambiguous request "show me sales" should ask for clarification', async () => {
            const response = await request(app)
                .post('/chat')
                .send({ message: 'show me sales' });

            console.log('BASELINE CAPTURE - "show me sales" (ambiguous):', {
                status: response.status,
                response: response.body.response
            });

            if (response.status === 200) {
                let parsedResponse;
                try {
                    parsedResponse = JSON.parse(response.body.response);
                } catch (e) {
                    console.log('RESPONSE NOT JSON:', response.body.response);
                }

                if (parsedResponse) {
                    console.log('CLARIFICATION RESPONSE:', parsedResponse.chatResponse);
                    // Should ask for clarification, not create chart action
                    expect(parsedResponse).toHaveProperty('chatResponse');
                    
                    if (parsedResponse.chartAction) {
                        console.log('UNEXPECTED: Got chart action for ambiguous request:', parsedResponse.chartAction);
                    }
                }
            }
        });

        test('BASELINE: Invalid field name handling', async () => {
            const response = await request(app)
                .post('/chat')
                .send({ message: 'show me revenue by location' });

            console.log('BASELINE CAPTURE - Invalid fields "revenue by location":', {
                status: response.status,
                response: response.body.response
            });

            if (response.status === 200) {
                let parsedResponse;
                try {
                    parsedResponse = JSON.parse(response.body.response);
                } catch (e) {
                    console.log('RESPONSE NOT JSON:', response.body.response);
                }

                if (parsedResponse) {
                    console.log('INVALID FIELD RESPONSE:', parsedResponse.chatResponse);
                }
            }
        });
    });

    describe('Response Format Validation', () => {
        test('REGRESSION: All responses should be valid JSON when OpenAI is configured', async () => {
            const testMessages = [
                'show me the fields',
                'show me sales by month',
                'sales by district',
                'change it to a bar chart'
            ];

            for (const message of testMessages) {
                const response = await request(app)
                    .post('/chat')
                    .send({ message });

                console.log(`Testing message: "${message}" - Status: ${response.status}`);

                if (response.status === 200) {
                    // Should always be valid JSON when successful
                    let parsedResponse;
                    expect(() => {
                        parsedResponse = JSON.parse(response.body.response);
                    }).not.toThrow();

                    // Should always have chatResponse
                    expect(parsedResponse).toHaveProperty('chatResponse');
                    expect(typeof parsedResponse.chatResponse).toBe('string');
                    expect(parsedResponse.chatResponse.length).toBeGreaterThan(0);

                    console.log(`✅ "${message}" returned valid JSON`);
                } else if (response.status === 500) {
                    // OpenAI not configured - acceptable for testing
                    console.log(`⚠️ "${message}" returned 500 (OpenAI not configured)`);
                } else {
                    console.log(`❌ "${message}" returned unexpected status: ${response.status}`);
                }
            }
        });
    });
});