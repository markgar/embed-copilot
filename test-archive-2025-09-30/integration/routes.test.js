const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const mountRoutes = require('../../src-v2/routes');

// Mock dependencies
jest.mock('../../src-v2/controllers/embedController');
jest.mock('../../src-v2/controllers/metadataController');
jest.mock('../../src-v2/controllers/chatController');
jest.mock('../../src-v2/controllers/systemController');

const embedController = require('../../src-v2/controllers/embedController');
const metadataController = require('../../src-v2/controllers/metadataController');
const chatController = require('../../src-v2/controllers/chatController');
const systemController = require('../../src-v2/controllers/systemController');

describe('Routes Integration Tests', () => {
    let app;

    beforeEach(() => {
        // Create fresh app for each test
        app = express();
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: true }));
        
        // Mount routes
        mountRoutes(app);
        
        // Reset all mocks
        jest.clearAllMocks();
    });

    describe('View Routes', () => {
        test('GET / should serve chartchat.html', async () => {
            const response = await request(app).get('/');
            expect(response.status).toBe(200);
            expect(response.type).toBe('text/html');
        });

        test('GET /chartchat should serve chartchat.html', async () => {
            const response = await request(app).get('/chartchat');
            expect(response.status).toBe(200);
            expect(response.type).toBe('text/html');
        });
    });

    describe('Embed Routes', () => {
        test('GET /getEmbedToken should call embedController', async () => {
            const mockResponse = { status: 200, accessToken: 'test-token' };
            embedController.getEmbedToken.mockImplementation((req, res) => {
                res.status(200).json(mockResponse);
            });

            const response = await request(app).get('/getEmbedToken');
            
            expect(embedController.getEmbedToken).toHaveBeenCalledTimes(1);
            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockResponse);
        });
    });

    describe('Metadata Routes', () => {
        test('GET /getDatasetMetadata should call metadataController', async () => {
            const mockMetadata = { dataset: { name: 'Test Dataset' }, schema: 'test schema' };
            metadataController.getDatasetMetadata.mockImplementation((req, res) => {
                res.json(mockMetadata);
            });

            const response = await request(app).get('/getDatasetMetadata');
            
            expect(metadataController.getDatasetMetadata).toHaveBeenCalledTimes(1);
            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockMetadata);
        });

        test('GET /debug/metadata should call metadataController', async () => {
            const mockDebugInfo = { status: 'cached', cacheInfo: { lastFetched: '2024-01-01' } };
            metadataController.getMetadataDebugInfo.mockImplementation((req, res) => {
                res.json(mockDebugInfo);
            });

            const response = await request(app).get('/debug/metadata');
            
            expect(metadataController.getMetadataDebugInfo).toHaveBeenCalledTimes(1);
            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockDebugInfo);
        });
    });

    describe('Chat Routes', () => {
        test('POST /chat should call chatController', async () => {
            const mockChatResponse = { response: 'AI response' };
            chatController.chat.mockImplementation((req, res) => {
                res.json(mockChatResponse);
            });

            const response = await request(app)
                .post('/chat')
                .send({ message: 'Hello', conversation: [] });
            
            expect(chatController.chat).toHaveBeenCalledTimes(1);
            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockChatResponse);
        });
    });

    describe('System Routes', () => {
        test('GET /health should call systemController', async () => {
            const mockHealth = { status: 'ok', timestamp: '2024-01-01' };
            systemController.healthCheck.mockImplementation((req, res) => {
                res.json(mockHealth);
            });

            const response = await request(app).get('/health');
            
            expect(systemController.healthCheck).toHaveBeenCalledTimes(1);
            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockHealth);
        });

        test('POST /log-error should call systemController', async () => {
            systemController.logError.mockImplementation((req, res) => {
                res.json({ success: true });
            });

            const response = await request(app)
                .post('/log-error')
                .send({ error: 'Test error' });
            
            expect(systemController.logError).toHaveBeenCalledTimes(1);
            expect(response.status).toBe(200);
            expect(response.body).toEqual({ success: true });
        });

        test('POST /log-console should call systemController', async () => {
            systemController.logConsole.mockImplementation((req, res) => {
                res.json({ success: true });
            });

            const response = await request(app)
                .post('/log-console')
                .send({ message: 'Test message' });
            
            expect(systemController.logConsole).toHaveBeenCalledTimes(1);
            expect(response.status).toBe(200);
            expect(response.body).toEqual({ success: true });
        });

        test('POST /telemetry-control should call systemController', async () => {
            systemController.telemetryControl.mockImplementation((req, res) => {
                res.json({ success: true, message: 'Telemetry enabled' });
            });

            const response = await request(app)
                .post('/telemetry-control')
                .send({ action: 'enable' });
            
            expect(systemController.telemetryControl).toHaveBeenCalledTimes(1);
            expect(response.status).toBe(200);
            expect(response.body).toEqual({ success: true, message: 'Telemetry enabled' });
        });
    });
});