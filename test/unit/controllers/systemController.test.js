const SystemController = require('../../../src-v2/controllers/systemController');
const errorService = require('../../../src-v2/services/errorService');
const telemetry = require('../../../src-v2/services/telemetryService');
const fs = require('fs').promises;
const path = require('path');

// Mock dependencies
jest.mock('../../../src-v2/services/errorService');
jest.mock('../../../src-v2/services/telemetryService');
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        access: jest.fn()
    }
}));

// Mock configService properly
jest.mock('../../../src-v2/services/configService', () => ({
    configService: {
        loadConfig: jest.fn()
    }
}));

const { configService } = require('../../../src-v2/services/configService');

describe('SystemController', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();
        
        req = {
            query: {},
            body: {},
            method: 'GET',
            url: '/health'
        };
        
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            send: jest.fn()
        };

        // Mock services
        errorService.sendError = jest.fn();
        telemetry.recordEvent = jest.fn();
    });

    describe('healthCheck', () => {
        test('should return healthy status with service integration architecture', async () => {
            await SystemController.healthCheck(req, res);

            expect(res.json).toHaveBeenCalledWith({
                status: 'ok',
                version: 'src-v2',
                architecture: 'service-integration',
                timestamp: expect.any(String),
                services: {
                    embed: 'use /health/embed for details',
                    metadata: 'use /health/metadata for details',
                    chat: 'use /health/chat for details'
                }
            });
        });

        test('should handle errors gracefully', async () => {
            // Mock an error in the healthCheck
            const originalConsoleError = console.error;
            console.error = jest.fn();
            
            // Force an error by mocking res.json to throw
            res.json.mockImplementationOnce(() => {
                throw new Error('Mock error');
            });

            await SystemController.healthCheck(req, res);

            // Should call res.json again with error response
            expect(res.json).toHaveBeenCalledTimes(2);
            expect(res.json).toHaveBeenLastCalledWith({
                status: 'error',
                message: 'Mock error',
                timestamp: expect.any(String)
            });
            
            console.error = originalConsoleError;
        });
    });
});