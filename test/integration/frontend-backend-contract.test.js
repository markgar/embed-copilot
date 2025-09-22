/**
 * Frontend-Backend API Contract Test
 * This test specifically validates that the frontend and backend
 * are using the same API endpoints and data structures.
 * 
 * This test would have caught the TreeView bug where the ES6 module
 * was calling /api/metadata/tables instead of /getDatasetMetadata
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../../src-v2/app');

describe('Frontend-Backend API Contract Validation', () => {
    describe('TreeView Module Contract Tests', () => {
        test('TreeView module should use correct metadata endpoint', async () => {
            // Read the TreeView module to check what endpoint it's calling
            const treeviewModulePath = path.join(__dirname, '../../public/js/modules/treeview.js');
            
            if (fs.existsSync(treeviewModulePath)) {
                const treeviewContent = fs.readFileSync(treeviewModulePath, 'utf8');
                
                // Check that it's calling the correct endpoint
                expect(treeviewContent).toContain('/getDatasetMetadata');
                
                // Check that it's NOT calling the wrong endpoint
                expect(treeviewContent).not.toContain('/api/metadata/tables');
                
                console.log('✅ TreeView module is using correct endpoint');
            } else {
                console.warn('⚠️  TreeView module not found at expected path');
            }
        });

        test('TreeView module should use correct DOM element IDs', async () => {
            const treeviewModulePath = path.join(__dirname, '../../public/js/modules/treeview.js');
            const htmlPath = path.join(__dirname, '../../views/chartchat.html');
            
            if (fs.existsSync(treeviewModulePath) && fs.existsSync(htmlPath)) {
                const treeviewContent = fs.readFileSync(treeviewModulePath, 'utf8');
                const htmlContent = fs.readFileSync(htmlPath, 'utf8');
                
                // Check that TreeView is looking for the correct container ID
                expect(treeviewContent).toContain('treeview-content');
                expect(htmlContent).toContain('id="treeview-content"');
                
                // Check that it's NOT looking for the wrong container ID
                expect(treeviewContent).not.toContain('tree-view-container');
                
                console.log('✅ TreeView module is using correct DOM element IDs');
            }
        });

        test('Metadata endpoint returns structure expected by TreeView', async () => {
            const response = await request(app)
                .get('/getDatasetMetadata')
                .expect(200);

            const metadata = response.body;

            // TreeView specifically expects these properties
            expect(metadata).toHaveProperty('tables');
            expect(Array.isArray(metadata.tables)).toBe(true);

            // Simulate what TreeView does with the data
            if (metadata.tables.length > 0) {
                const table = metadata.tables[0];
                
                // TreeView expects these table properties
                expect(table).toHaveProperty('name');
                expect(table).toHaveProperty('type');
                expect(table).toHaveProperty('columns');
                
                // TreeView renders table.name
                expect(typeof table.name).toBe('string');
                expect(table.name.length).toBeGreaterThan(0);
                
                // TreeView counts table.columns
                expect(Array.isArray(table.columns)).toBe(true);
                
                if (table.columns.length > 0) {
                    const column = table.columns[0];
                    // TreeView renders column.name and column.type
                    expect(column).toHaveProperty('name');
                    expect(column).toHaveProperty('type');
                    expect(typeof column.name).toBe('string');
                    expect(typeof column.type).toBe('string');
                }
            }
        });
    });

    describe('Endpoint Consistency Tests', () => {
        test('All expected frontend endpoints should exist', async () => {
            // List of endpoints that the frontend modules expect to exist
            const expectedEndpoints = [
                '/getDatasetMetadata',
                '/debug/metadata'
            ];

            for (const endpoint of expectedEndpoints) {
                const response = await request(app)
                    .get(endpoint);
                
                // Should not be 404 - either success or other error is fine
                expect(response.status).not.toBe(404);
                console.log(`✅ Endpoint ${endpoint} exists (status: ${response.status})`);
            }
        });

        test('Deprecated or incorrect endpoints should not exist', async () => {
            // List of endpoints that should NOT exist (common mistakes or old versions)
            const deprecatedEndpoints = [
                '/api/metadata/tables',
                '/api/metadata',
                '/metadata/tables',
                '/getMetadata',
                '/api/tables'
            ];

            for (const endpoint of deprecatedEndpoints) {
                const response = await request(app)
                    .get(endpoint);
                
                // These should all be 404
                expect(response.status).toBe(404);
                console.log(`✅ Deprecated endpoint ${endpoint} correctly returns 404`);
            }
        });
    });

    describe('Module Integration Tests', () => {
        test('Check if ES6 modules are properly referenced in HTML', () => {
            const htmlPath = path.join(__dirname, '../../views/chartchat.html');
            
            if (fs.existsSync(htmlPath)) {
                const htmlContent = fs.readFileSync(htmlPath, 'utf8');
                
                // Check that treeview module is properly loaded
                expect(htmlContent).toContain('modules/treeview.js');
                
                // Check that it's loaded as ES6 module
                expect(htmlContent).toContain('type="module"');
                
                console.log('✅ TreeView module is properly referenced in HTML');
            }
        });

        test('Verify module exports match imports', () => {
            const treeviewPath = path.join(__dirname, '../../public/js/modules/treeview.js');
            const appPath = path.join(__dirname, '../../public/js/modules/app.js');
            
            if (fs.existsSync(treeviewPath) && fs.existsSync(appPath)) {
                const treeviewContent = fs.readFileSync(treeviewPath, 'utf8');
                const appContent = fs.readFileSync(appPath, 'utf8');
                
                // Check that initializeTreeView is exported
                expect(treeviewContent).toContain('export');
                expect(treeviewContent).toContain('initializeTreeView');
                
                // Check that app.js imports it correctly
                expect(appContent).toContain('import');
                expect(appContent).toContain('initializeTreeView');
                expect(appContent).toContain('treeview.js');
                
                console.log('✅ TreeView module exports/imports are consistent');
            }
        });
    });

    describe('Data Structure Validation', () => {
        test('Metadata response structure should match documented contract', async () => {
            const response = await request(app)
                .get('/getDatasetMetadata')
                .expect(200);

            const metadata = response.body;

            // Document the expected structure for future reference
            const expectedStructure = {
                dataset: {
                    name: 'string'
                },
                lastUpdated: 'string',
                tables: [{
                    name: 'string',
                    type: 'string',
                    columns: [{
                        name: 'string',
                        type: 'string',
                        description: 'string (optional)'
                    }]
                }],
                measures: [{
                    table: 'string',
                    name: 'string',
                    dataType: 'string',
                    description: 'string (optional)'
                }],
                dimensions: [{
                    table: 'string',
                    name: 'string',
                    dataType: 'string',
                    description: 'string (optional)'
                }]
            };

            // Validate the actual response matches the expected structure
            expect(metadata).toMatchObject({
                dataset: expect.objectContaining({
                    name: expect.any(String)
                }),
                lastUpdated: expect.any(String),
                tables: expect.any(Array),
                measures: expect.any(Array),
                dimensions: expect.any(Array)
            });

            console.log('✅ Metadata response structure is valid');
            console.log(`📊 Found ${metadata.tables.length} tables, ${metadata.measures.length} measures, ${metadata.dimensions.length} dimensions`);
        });
    });
});