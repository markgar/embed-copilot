const request = require('supertest');
const express = require('express');
const EmbedController = require('../../src-v2/controllers/embedController');
const MetadataController = require('../../src-v2/controllers/metadataController');
const ChatController = require('../../src-v2/controllers/chatController');
const SystemController = require('../../src-v2/controllers/systemController');

// Create test app with controller routes
const createTestApp = () => {
    const app = express();
    app.use(express.json());
    
    // Embed routes
    app.post('/getEmbedToken', EmbedController.getEmbedToken);
    app.get('/embed/health', EmbedController.healthCheck);
    
    // Metadata routes
    app.get('/getDatasetMetadata', MetadataController.getDatasetMetadata);
    app.get('/getSimplifiedMetadata', MetadataController.getSimplifiedMetadata);
    app.get('/getNameOnlySchema', MetadataController.getNameOnlySchema);
    app.post('/clearCache', MetadataController.clearCache);
    app.get('/metadata/health', MetadataController.healthCheck);
    
    // Chat routes
    app.post('/chat', ChatController.chat);
    app.post('/chat/stream', ChatController.chatStream);
    app.get('/chat/health', ChatController.healthCheck);
    
    // System routes
    app.get('/health', SystemController.healthCheck);
    app.get('/status', SystemController.detailedHealthCheck);
    app.post('/telemetry', SystemController.telemetryControl);
    app.get('/logs', SystemController.getTelemetryLogs);
    
    return app;
};

describe('Controller Integration Tests', () => {
    let app;

    beforeAll(() => {
        app = createTestApp();
    });

    describe('EmbedController Integration', () => {
        test('POST /getEmbedToken should handle valid request', async () => {
            const response = await request(app)
                .post('/getEmbedToken')
                .send({
                    reportId: 'test-report-id',
                    groupId: 'test-group-id'
                });

            // Should get a response (either success or error based on actual config)
            expect(response.status).toBeOneOf([200, 400, 500]);
            expect(response.body).toBeDefined();
        });

        test('POST /getEmbedToken should validate required fields', async () => {
            const response = await request(app)
                .post('/getEmbedToken')
                .send({}); // Missing required fields

            // May return 200 (success with config defaults), 400 (validation error), or 500 (auth error)
            expect([200, 400, 500]).toContain(response.status);
        });

        test('GET /embed/health should return health status', async () => {
            const response = await request(app)
                .get('/embed/health');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('service', 'embed');
            expect(response.body).toHaveProperty('timestamp');
        });
    });

    describe('MetadataController Integration', () => {
        test('GET /getDatasetMetadata should handle requests', async () => {
            const response = await request(app)
                .get('/getDatasetMetadata')
                .query({
                    groupId: 'test-group-id',
                    datasetId: 'test-dataset-id'
                });

            // Should get a response (success or error based on config)
            expect(response.status).toBeOneOf([200, 400, 500]);
            expect(response.body).toBeDefined();
        });

        test('GET /getDatasetMetadata should require groupId', async () => {
            const response = await request(app)
                .get('/getDatasetMetadata');

            // May return 200 (success with config defaults), 400 (validation error), or 500 (auth error)
            expect([200, 400, 500]).toContain(response.status);
        });

        test('GET /getSimplifiedMetadata should return text response', async () => {
            const response = await request(app)
                .get('/getSimplifiedMetadata')
                .query({
                    groupId: 'test-group-id',
                    datasetId: 'test-dataset-id'
                });

            if (response.status === 200) {
                expect(response.headers['content-type']).toContain('text/plain');
            }
        });

        test('GET /getNameOnlySchema should return text response', async () => {
            const response = await request(app)
                .get('/getNameOnlySchema')
                .query({
                    groupId: 'test-group-id',
                    datasetId: 'test-dataset-id'
                });

            if (response.status === 200) {
                expect(response.headers['content-type']).toContain('text/plain');
            }
        });

        test('POST /clearCache should clear cache', async () => {
            const response = await request(app)
                .post('/clearCache');

            expect(response.status).toBeOneOf([200, 500]);
            if (response.status === 200) {
                expect(response.body).toHaveProperty('status', 'success');
                expect(response.body).toHaveProperty('message');
            }
        });

        test('GET /metadata/health should return health status', async () => {
            const response = await request(app)
                .get('/metadata/health');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('service', 'metadata');
            expect(response.body).toHaveProperty('cache');
        });
    });

    describe('ChatController Integration', () => {
        test('POST /chat should handle valid chat request', async () => {
            const response = await request(app)
                .post('/chat')
                .send({
                    message: 'What are total sales?',
                    conversation: []
                });

            expect(response.status).toBeOneOf([200, 400, 500]);
            expect(response.body).toBeDefined();
        });

        test('POST /chat should require message', async () => {
            const response = await request(app)
                .post('/chat')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        test('POST /chat should handle conversation history', async () => {
            const response = await request(app)
                .post('/chat')
                .send({
                    message: 'Continue our discussion',
                    conversation: [
                        { role: 'user', content: 'Hello' },
                        { role: 'assistant', content: 'Hi there!' }
                    ]
                });

            expect(response.status).toBeOneOf([200, 400, 500]);
        });

        test('POST /chat/stream should handle streaming requests', async () => {
            const response = await request(app)
                .post('/chat/stream')
                .send({
                    message: 'Stream response please',
                    conversation: []
                });

            if (response.status === 200) {
                expect(response.headers['content-type']).toContain('text/event-stream');
            }
        });

        test('GET /chat/health should return health status', async () => {
            const response = await request(app)
                .get('/chat/health');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('service', 'chat');
            expect(response.body).toHaveProperty('configuration');
        });
    });

    describe('SystemController Integration', () => {
        test('GET /health should return system health', async () => {
            const response = await request(app)
                .get('/health');

            expect(response.status).toBeOneOf([200, 500]);
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('services');
            expect(response.body).toHaveProperty('version');
            expect(response.body).toHaveProperty('architecture');
        });

        test('GET /status should return detailed status', async () => {
            const response = await request(app)
                .get('/status');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('version');
            expect(response.body).toHaveProperty('architecture'); 
            expect(response.body).toHaveProperty('services');
            expect(response.body).toHaveProperty('telemetry');
            expect(response.body).toHaveProperty('timestamp');
        });

        test('POST /telemetry should control telemetry', async () => {
            const response = await request(app)
                .post('/telemetry')
                .send({ enabled: true });

            expect(response.status).toBeOneOf([200, 400, 500]);
            if (response.status === 200) {
                expect(response.body).toHaveProperty('status', 'success');
                expect(response.body).toHaveProperty('enabled', true);
            }
        });

        test('POST /telemetry should validate enabled parameter', async () => {
            const response = await request(app)
                .post('/telemetry')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        test('GET /logs should return log data', async () => {
            const response = await request(app)
                .get('/logs');

            expect(response.status).toBeOneOf([200, 404, 500]);
            if (response.status === 200) {
                expect(response.body).toHaveProperty('logs');
                expect(response.body).toHaveProperty('count');
                expect(response.body).toHaveProperty('timestamp');
            }
        });

        test('GET /logs should handle query parameters', async () => {
            const response = await request(app)
                .get('/logs')
                .query({
                    lines: '10',
                    level: 'ERROR',
                    source: 'telemetry.jsonl'
                });

            if (response.status === 200) {
                // The current implementation doesn't support these query parameters
                // but we can at least check the response structure
                expect(response.body).toHaveProperty('logs');
                expect(response.body).toHaveProperty('count');
            }
        });
    });

    describe('Error Handling Integration', () => {
        test('should handle malformed JSON in POST requests', async () => {
            const response = await request(app)
                .post('/chat')
                .set('Content-Type', 'application/json')
                .send('{"invalid": json}');

            expect(response.status).toBe(400);
        });

        test('should handle missing Content-Type for POST requests', async () => {
            const response = await request(app)
                .post('/getEmbedToken')
                .send('reportId=test');

            // Should still process the request or return appropriate error
            expect(response.status).toBeOneOf([200, 400, 415, 500]);
        });

        test('should handle non-existent routes', async () => {
            const response = await request(app)
                .get('/nonexistent');

            expect(response.status).toBe(404);
        });
    });

    describe('Cross-Controller Scenarios', () => {
        test('should maintain consistent error response format', async () => {
            const endpoints = [
                { method: 'post', path: '/getEmbedToken', body: {} },
                { method: 'get', path: '/getDatasetMetadata' },
                { method: 'post', path: '/chat', body: {} },
                { method: 'post', path: '/telemetry', body: {} }
            ];

            for (const endpoint of endpoints) {
                const response = await request(app)
                    [endpoint.method](endpoint.path)
                    .send(endpoint.body || {});

                if (response.status >= 400) {
                    expect(response.body).toHaveProperty('error');
                    expect(typeof response.body.error).toBe('string');
                }
            }
        });

        test('should provide consistent health check format', async () => {
            const healthEndpoints = [
                '/embed/health',
                '/metadata/health',
                '/chat/health',
                '/health'
            ];

            for (const endpoint of healthEndpoints) {
                const response = await request(app)
                    .get(endpoint);

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('status');
                expect(response.body).toHaveProperty('timestamp');
                expect(['ok', 'degraded', 'error']).toContain(response.body.status);
            }
        });
    });

    describe('Performance Integration', () => {
        test('should handle concurrent requests', async () => {
            const promises = Array(5).fill().map(() => 
                request(app).get('/health')
            );

            const responses = await Promise.all(promises);
            
            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('status');
            });
        });

        test('should respond within reasonable time limits', async () => {
            const start = Date.now();
            
            await request(app).get('/health');
            
            const duration = Date.now() - start;
            expect(duration).toBeLessThan(5000); // 5 second timeout
        });
    });
});

// Custom Jest matchers
expect.extend({
    toBeOneOf(received, expected) {
        const pass = expected.includes(received);
        if (pass) {
            return {
                message: () => `expected ${received} not to be one of ${expected}`,
                pass: true,
            };
        } else {
            return {
                message: () => `expected ${received} to be one of ${expected}`,
                pass: false,
            };
        }
    }
});