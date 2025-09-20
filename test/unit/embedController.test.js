const EmbedController = require('../../src-v2/controllers/embedController');
const PowerBIService = require('../../src-v2/services/powerbiService');
const errorService = require('../../src-v2/services/errorService');
const utils = require('../../src-v2/utils');

// Mock dependencies
jest.mock('../../src-v2/services/powerbiService');
jest.mock('../../src-v2/services/errorService');
jest.mock('../../src-v2/utils');

describe('EmbedController', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();
        
        req = {
            body: {},
            query: {},
            method: 'GET',
            url: '/getEmbedToken'
        };
        
        res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
            json: jest.fn()
        };

        // Mock error service
        errorService.sendError = jest.fn();
    });

    describe('getEmbedToken', () => {
        test('should successfully get embed token when config is valid', async () => {
            // Mock valid configuration
            utils.validateConfig.mockReturnValue(null);
            
            // Mock PowerBI service response
            const mockEmbedResult = {
                status: 200,
                accessToken: 'mock-token',
                embedUrl: 'https://mock.powerbi.com/embed',
                expiry: new Date().toISOString()
            };
            
            const mockPowerBIService = {
                getEmbedInfo: jest.fn().mockResolvedValue(mockEmbedResult)
            };
            PowerBIService.mockImplementation(() => mockPowerBIService);

            await EmbedController.getEmbedToken(req, res);

            expect(utils.validateConfig).toHaveBeenCalledTimes(1);
            expect(PowerBIService).toHaveBeenCalledTimes(1);
            expect(mockPowerBIService.getEmbedInfo).toHaveBeenCalledTimes(1);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith(mockEmbedResult);
            expect(errorService.sendError).not.toHaveBeenCalled();
        });

        test('should return 400 error when configuration is invalid', async () => {
            const configError = 'Missing required configuration';
            utils.validateConfig.mockReturnValue(configError);

            await EmbedController.getEmbedToken(req, res);

            expect(utils.validateConfig).toHaveBeenCalledTimes(1);
            expect(PowerBIService).not.toHaveBeenCalled();
            expect(errorService.sendError).toHaveBeenCalledWith(res, 400, configError);
        });

        test('should handle PowerBI service errors gracefully', async () => {
            utils.validateConfig.mockReturnValue(null);
            
            const serviceError = new Error('PowerBI API error');
            const mockPowerBIService = {
                getEmbedInfo: jest.fn().mockRejectedValue(serviceError)
            };
            PowerBIService.mockImplementation(() => mockPowerBIService);

            await EmbedController.getEmbedToken(req, res);

            expect(mockPowerBIService.getEmbedInfo).toHaveBeenCalledTimes(1);
            expect(errorService.sendError).toHaveBeenCalledWith(
                res, 
                500, 
                'Failed to get embed token', 
                'PowerBI API error'
            );
        });

        test('should handle PowerBI service returning error status', async () => {
            utils.validateConfig.mockReturnValue(null);
            
            const mockEmbedResult = {
                status: 401,
                error: 'Unauthorized access'
            };
            
            const mockPowerBIService = {
                getEmbedInfo: jest.fn().mockResolvedValue(mockEmbedResult)
            };
            PowerBIService.mockImplementation(() => mockPowerBIService);

            await EmbedController.getEmbedToken(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.send).toHaveBeenCalledWith(mockEmbedResult);
        });
    });

    describe('healthCheck', () => {
        test('should return healthy status when configuration is valid', async () => {
            utils.validateConfig.mockReturnValue(null);
            PowerBIService.mockImplementation(() => ({})); // Mock successful instantiation

            await EmbedController.healthCheck(req, res);

            expect(utils.validateConfig).toHaveBeenCalledTimes(1);
            expect(PowerBIService).toHaveBeenCalledTimes(1);
            expect(res.json).toHaveBeenCalledWith({
                status: 'ok',
                service: 'embed',
                message: 'PowerBI service ready',
                timestamp: expect.any(String)
            });
        });

        test('should return error status when configuration is invalid', async () => {
            const configError = 'Missing PowerBI configuration';
            utils.validateConfig.mockReturnValue(configError);

            await EmbedController.healthCheck(req, res);

            expect(utils.validateConfig).toHaveBeenCalledTimes(1);
            expect(PowerBIService).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({
                status: 'error',
                service: 'embed',
                message: configError,
                timestamp: expect.any(String)
            });
        });

        test('should handle PowerBI service instantiation errors', async () => {
            utils.validateConfig.mockReturnValue(null);
            PowerBIService.mockImplementation(() => {
                throw new Error('Service initialization failed');
            });

            await EmbedController.healthCheck(req, res);

            expect(res.json).toHaveBeenCalledWith({
                status: 'error',
                service: 'embed',
                message: 'Service initialization failed',
                timestamp: expect.any(String)
            });
        });

        test('should include proper timestamp format', async () => {
            utils.validateConfig.mockReturnValue(null);
            PowerBIService.mockImplementation(() => ({}));

            const beforeTime = new Date().toISOString();
            await EmbedController.healthCheck(req, res);
            const afterTime = new Date().toISOString();

            const call = res.json.mock.calls[0][0];
            expect(call.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
            expect(call.timestamp >= beforeTime).toBe(true);
            expect(call.timestamp <= afterTime).toBe(true);
        });
    });

    describe('error handling', () => {
        test('should handle unexpected errors in getEmbedToken', async () => {
            utils.validateConfig.mockImplementation(() => {
                throw new Error('Unexpected validation error');
            });

            await EmbedController.getEmbedToken(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(
                res,
                500,
                'Failed to get embed token',
                'Unexpected validation error'
            );
        });

        test('should handle unexpected errors in healthCheck', async () => {
            utils.validateConfig.mockImplementation(() => {
                throw new Error('Unexpected health check error');
            });

            await EmbedController.healthCheck(req, res);

            expect(res.json).toHaveBeenCalledWith({
                status: 'error',
                service: 'embed',
                message: 'Unexpected health check error',
                timestamp: expect.any(String)
            });
        });
    });

    describe('method properties', () => {
        test('should have static methods', () => {
            expect(typeof EmbedController.getEmbedToken).toBe('function');
            expect(typeof EmbedController.healthCheck).toBe('function');
        });

        test('should not require instantiation', () => {
            // Should be able to call methods directly on class
            expect(() => EmbedController.getEmbedToken).not.toThrow();
            expect(() => EmbedController.healthCheck).not.toThrow();
        });
    });
});