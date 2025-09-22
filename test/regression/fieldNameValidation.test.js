const request = require('supertest');

/**
 * Field Name Validation Regression Test
 * Ensures AI model returns field names that exist in the actual metadata
 */
describe('AI Model Field Name Validation', () => {
    let app;

    beforeAll(() => {
        process.env.NODE_ENV = 'test';
        app = require('../../src-v2/app.js');
    });

    // Helper to extract valid field names from metadata response
    const getValidFieldsFromMetadata = async () => {
        const metadataResponse = await request(app)
            .get('/getDatasetMetadata');
        
        if (metadataResponse.status !== 200) {
            throw new Error('Failed to get metadata');
        }

        const metadata = metadataResponse.body;
        const validFields = [];

        // Extract all valid field names in Table.Field format
        metadata.tables.forEach(table => {
            table.columns.forEach(column => {
                validFields.push(`${table.name}.${column.name}`);
            });
        });

        return validFields;
    };

    // Helper to test a message and validate field names
    const testMessageFieldValidation = async (message, validFields) => {
        const response = await request(app)
            .post('/chat')
            .send({ message, chatHistory: [] });

        expect(response.status).toBe(200);
        
        const parsedResponse = JSON.parse(response.body.response);
        
        // Only validate if there's a chartAction
        if (parsedResponse.chartAction) {
            const { yAxis, xAxis } = parsedResponse.chartAction;
            
            // Check if yAxis field exists in metadata
            expect(validFields).toContain(yAxis);
            
            // Check if xAxis field exists in metadata  
            expect(validFields).toContain(xAxis);
            
            return { yAxis, xAxis, chartType: parsedResponse.chartAction.chartType };
        }
        
        return null;
    };

    test('should return valid field names for "sales by month"', async () => {
        const validFields = await getValidFieldsFromMetadata();
        console.log('Valid fields in metadata:', validFields);
        
        const chartAction = await testMessageFieldValidation('show me sales by month', validFields);
        
        expect(chartAction).not.toBeNull();
        expect(chartAction.yAxis).toMatch(/Sales\.TotalSales|Sales\.TotalUnits/);
        expect(chartAction.xAxis).toMatch(/Time\.Month/);
        
        console.log('✅ Field validation passed for "sales by month"');
        console.log('   yAxis:', chartAction.yAxis);
        console.log('   xAxis:', chartAction.xAxis);
    });

    test('should return valid field names for "sales by district"', async () => {
        const validFields = await getValidFieldsFromMetadata();
        
        const chartAction = await testMessageFieldValidation('sales by district', validFields);
        
        expect(chartAction).not.toBeNull();
        expect(chartAction.yAxis).toMatch(/Sales\.TotalSales|Sales\.TotalUnits/);
        expect(chartAction.xAxis).toMatch(/District\.District/);
        
        console.log('✅ Field validation passed for "sales by district"');
        console.log('   yAxis:', chartAction.yAxis);
        console.log('   xAxis:', chartAction.xAxis);
    });

    test('should return valid field names for "units by category"', async () => {
        const validFields = await getValidFieldsFromMetadata();
        
        const chartAction = await testMessageFieldValidation('show me units by category', validFields);
        
        expect(chartAction).not.toBeNull();
        expect(chartAction.yAxis).toMatch(/Sales\.TotalUnits/);
        expect(chartAction.xAxis).toMatch(/Item\.Category/);
        
        console.log('✅ Field validation passed for "units by category"');
        console.log('   yAxis:', chartAction.yAxis);
        console.log('   xAxis:', chartAction.xAxis);
    });

    test('should return valid field names for "bar chart of sales by district"', async () => {
        const validFields = await getValidFieldsFromMetadata();
        
        const chartAction = await testMessageFieldValidation('bar chart of sales by district', validFields);
        
        expect(chartAction).not.toBeNull();
        // For bar charts, axes are swapped
        expect(chartAction.yAxis).toMatch(/District\.District/);
        expect(chartAction.xAxis).toMatch(/Sales\.TotalSales|Sales\.TotalUnits/);
        
        console.log('✅ Field validation passed for "bar chart of sales by district"');
        console.log('   yAxis:', chartAction.yAxis);
        console.log('   xAxis:', chartAction.xAxis);
    });

    test('all chart responses should use Table.Field naming convention', async () => {
        const validFields = await getValidFieldsFromMetadata();
        
        const testMessages = [
            'show me sales by month',
            'sales by district', 
            'units by category',
            'revenue by quarter'
        ];

        for (const message of testMessages) {
            const response = await request(app)
                .post('/chat')
                .send({ message, chatHistory: [] });

            if (response.status === 200) {
                const parsedResponse = JSON.parse(response.body.response);
                
                if (parsedResponse.chartAction) {
                    const { yAxis, xAxis } = parsedResponse.chartAction;
                    
                    // Must use Table.Field format
                    expect(yAxis).toMatch(/^[A-Za-z]+\.[A-Za-z]+$/);
                    expect(xAxis).toMatch(/^[A-Za-z]+\.[A-Za-z]+$/);
                    
                    // Must exist in metadata
                    expect(validFields).toContain(yAxis);
                    expect(validFields).toContain(xAxis);
                    
                    console.log(`✅ "${message}" -> yAxis: ${yAxis}, xAxis: ${xAxis}`);
                }
            }
        }
    });

    test('should provide helpful error message for missing fields in metadata', async () => {
        // This test documents what should happen when the model returns invalid fields
        // It will initially fail, demonstrating the problem, then pass once we fix the prompt
        
        const validFields = await getValidFieldsFromMetadata();
        console.log('Testing against valid fields:', validFields);
        
        try {
            await testMessageFieldValidation('show me sales by month', validFields);
            console.log('✅ Model correctly uses valid field names');
        } catch (error) {
            console.log('❌ Model returned invalid field names:');
            console.log('   Error:', error.message);
            console.log('   This test will pass once the prompt is fixed');
            
            // Re-throw to fail the test and highlight the issue
            throw new Error(`Field validation failed: ${error.message}. Check if model is using correct Table.Field format.`);
        }
    });
});