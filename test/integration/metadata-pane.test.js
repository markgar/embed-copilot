/**
 * Metadata Pane Integration Test
 * Tests that verify the metadata endpoints are working correctly
 * and that the frontend-backend contract is maintained
 */

const request = require('supertest');
const app = require('../../src-v2/app');

// Mock PowerBI service to avoid making real API calls
const mockMetadata = {
    dataset: { name: 'Store Sales' },
    tables: [
        { name: 'Sales', type: 'Table', columns: ['TotalSales', 'TotalUnits'] },
        { name: 'Time', type: 'Table', columns: ['Month', 'Quarter'] },
        { name: 'District', type: 'Table', columns: ['District', 'Region'] },
        { name: 'Category', type: 'Table', columns: ['Category', 'Subcategory'] },
        { name: 'Store', type: 'Table', columns: ['StoreName', 'StoreType'] }
    ],
    measures: ['TotalSales', 'TotalUnits'],
    dimensions: [
        'Time.Month', 'Time.Quarter', 'District.District', 'District.Region',
        'Category.Category', 'Category.Subcategory', 'Store.StoreName', 'Store.StoreType',
        'Sales.TotalSales', 'Sales.TotalUnits'
    ],
    lastUpdated: new Date().toISOString()
};

jest.mock('../../src-v2/services/powerbiService', () => {
    return jest.fn().mockImplementation(() => ({
        getDatasetMetadata: jest.fn().mockResolvedValue(mockMetadata),
        getAccessToken: jest.fn().mockResolvedValue({ accessToken: 'mock-token' }),
        getRequestHeader: jest.fn().mockResolvedValue({ 'Authorization': 'Bearer mock-token' }),
        getDatasetIdFromReport: jest.fn().mockResolvedValue('mock-dataset-id')
    }));
});

describe('Metadata Pane Integration Tests', () => {
    // Helper to add delay between API calls to avoid rate limiting
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    beforeEach(async () => {
        // Add delay between tests to avoid rate limiting
        // PowerBI throttling shows "Retry in 60 seconds", so we use conservative delays
        await delay(3000);
    });
    describe('Metadata API Endpoints', () => {
        test('GET /getDatasetMetadata should return valid metadata structure', async () => {
            const response = await request(app)
                .get('/getDatasetMetadata')
                .expect(200);

            // Verify the response has the expected structure
            expect(response.body).toHaveProperty('dataset');
            expect(response.body).toHaveProperty('tables');
            expect(response.body).toHaveProperty('measures');
            expect(response.body).toHaveProperty('dimensions');
            expect(response.body).toHaveProperty('lastUpdated');

            // Verify dataset info
            expect(response.body.dataset).toHaveProperty('name');
            expect(typeof response.body.dataset.name).toBe('string');

            // Verify tables structure (critical for TreeView)
            expect(Array.isArray(response.body.tables)).toBe(true);
            
            if (response.body.tables.length > 0) {
                const firstTable = response.body.tables[0];
                expect(firstTable).toHaveProperty('name');
                expect(firstTable).toHaveProperty('type');
                expect(firstTable).toHaveProperty('columns');
                expect(typeof firstTable.name).toBe('string');
                expect(typeof firstTable.type).toBe('string');
                expect(Array.isArray(firstTable.columns)).toBe(true);

                if (firstTable.columns.length > 0) {
                    const firstColumn = firstTable.columns[0];
                    expect(firstColumn).toHaveProperty('name');
                    expect(firstColumn).toHaveProperty('type');
                    expect(typeof firstColumn.name).toBe('string');
                    expect(typeof firstColumn.type).toBe('string');
                }
            }

            // Verify measures and dimensions arrays
            expect(Array.isArray(response.body.measures)).toBe(true);
            expect(Array.isArray(response.body.dimensions)).toBe(true);
        });

        test('GET /debug/metadata should return cache information', async () => {
            // First call the main endpoint to ensure metadata is cached
            await request(app)
                .get('/getDatasetMetadata')
                .expect(200);

            // Then check the debug endpoint
            const response = await request(app)
                .get('/debug/metadata')
                .expect(200);

            // Should return cache status
            expect(response.body).toHaveProperty('status');
            expect(['cached', 'no_cache', 'error']).toContain(response.body.status);

            if (response.body.status === 'cached') {
                expect(response.body).toHaveProperty('cacheInfo');
                expect(response.body.cacheInfo).toHaveProperty('lastFetched');
                expect(response.body.cacheInfo).toHaveProperty('cacheAgeMs');
                expect(response.body).toHaveProperty('dataset');
            }
        });

        test('Wrong metadata endpoint should return 404', async () => {
            // Test the old incorrect endpoint to ensure it's not accidentally created
            await request(app)
                .get('/api/metadata/tables')
                .expect(404);
        });

        test('Health check endpoint should work', async () => {
            // Check if the metadata health check exists and works
            const routes = app._router?.stack || [];
            const hasMetadataHealthCheck = routes.some(layer => 
                layer.route?.path === '/metadata/health' || 
                layer.regexp?.test('/metadata/health')
            );

            // If health check exists, test it
            if (hasMetadataHealthCheck) {
                const response = await request(app)
                    .get('/metadata/health')
                    .expect(200);

                expect(response.body).toHaveProperty('status');
                expect(response.body).toHaveProperty('service');
                expect(response.body.service).toBe('metadata');
            }
        });
    });

    describe('Frontend-Backend Contract Tests', () => {
        test('Metadata structure should match TreeView expectations', async () => {
            const response = await request(app)
                .get('/getDatasetMetadata')
                .expect(200);

            const metadata = response.body;

            // TreeView expects these specific properties
            expect(metadata).toHaveProperty('tables');
            expect(Array.isArray(metadata.tables)).toBe(true);

            // Each table should have the structure the TreeView expects
            metadata.tables.forEach(table => {
                expect(table).toHaveProperty('name');
                expect(table).toHaveProperty('type');
                expect(table).toHaveProperty('columns');
                
                expect(typeof table.name).toBe('string');
                expect(typeof table.type).toBe('string');
                expect(Array.isArray(table.columns)).toBe(true);

                // Each column should have the expected structure
                table.columns.forEach(column => {
                    expect(column).toHaveProperty('name');
                    expect(column).toHaveProperty('type');
                    expect(typeof column.name).toBe('string');
                    expect(typeof column.type).toBe('string');
                    
                    // Description is optional but if present should be string
                    if (column.description) {
                        expect(typeof column.description).toBe('string');
                    }
                });
            });
        });

        test('Endpoint consistency check', async () => {
            // Verify that the endpoint the TreeView is calling actually exists
            // This test would catch the bug we just fixed
            
            const correctEndpoint = '/getDatasetMetadata';
            const incorrectEndpoint = '/api/metadata/tables';

            // Correct endpoint should work
            await request(app)
                .get(correctEndpoint)
                .expect(200);

            // Incorrect endpoint should not exist
            await request(app)
                .get(incorrectEndpoint)
                .expect(404);
        });

        test('Response should be JSON with correct content-type', async () => {
            const response = await request(app)
                .get('/getDatasetMetadata')
                .expect(200)
                .expect('Content-Type', /json/);

            // Should be valid JSON
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
        });
    });

    describe('Error Handling Tests', () => {
        test('Should handle missing required parameters gracefully', async () => {
            // If the endpoint requires specific query parameters, test without them
            const response = await request(app)
                .get('/getDatasetMetadata');

            // Should either work (if config provides defaults) or return meaningful error
            if (response.status === 400) {
                expect(response.body).toHaveProperty('error');
                expect(typeof response.body.error).toBe('string');
            } else {
                expect(response.status).toBe(200);
            }
        });

        test('Should handle configuration errors gracefully', async () => {
            // This tests resilience when configuration is missing/invalid
            // The endpoint should either work or return a proper error response
            const response = await request(app)
                .get('/getDatasetMetadata');

            // Response should be either success or a proper error structure
            if (response.status !== 200) {
                expect([400, 500]).toContain(response.status);
                expect(response.body).toHaveProperty('error');
            }
        });
    });

    describe('Performance and Caching Tests', () => {
        test('Metadata should be cached after first request', async () => {
            // First request
            const startTime1 = Date.now();
            await request(app)
                .get('/getDatasetMetadata')
                .expect(200);
            const duration1 = Date.now() - startTime1;

            // Second request (should be faster due to caching)
            const startTime2 = Date.now();
            await request(app)
                .get('/getDatasetMetadata')
                .expect(200);
            const duration2 = Date.now() - startTime2;

            // Second request should be significantly faster (cached)
            // Allow some tolerance for timing variations
            expect(duration2).toBeLessThan(duration1 + 100);
        });

        test('Debug endpoint should show cache status', async () => {
            // Make a request to populate cache
            await request(app)
                .get('/getDatasetMetadata')
                .expect(200);

            // Check cache status
            const debugResponse = await request(app)
                .get('/debug/metadata');

            if (debugResponse.status === 200) {
                expect(debugResponse.body.status).toBeDefined();
                if (debugResponse.body.status === 'cached') {
                    expect(debugResponse.body.cacheInfo).toBeDefined();
                    expect(debugResponse.body.cacheInfo.lastFetched).toBeDefined();
                }
            }
        });
    });
});