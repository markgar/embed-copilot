const SystemController = require('../../src-v2/controllers/systemController');
const errorService = require('../../src-v2/services/errorService');
const telemetry = require('../../src/telemetry');
const fs = require('fs').promises;
const path = require('path');

// Mock dependencies
jest.mock('../../src-v2/services/errorService');
jest.mock('../../src/telemetry');
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        access: jest.fn()
    }
}));

// Mock configService properly
jest.mock('../../src-v2/services/configService', () => ({
    configService: {
        loadConfig: jest.fn()
    }
}));

const { configService } = require('../../src-v2/services/configService');

describe('SystemController', () => {
    let req, res;
    const mockConfig = {
        powerBIGroupId: 'test-group-id',
        powerBIDatasetId: 'test-dataset-id',
        openaiApiKey: 'test-api-key'
    };

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
        configService.loadConfig = jest.fn().mockReturnValue(mockConfig);
        errorService.sendError = jest.fn();
        telemetry.recordEvent = jest.fn();
    });

    describe('health', () => {
        test('should return healthy status when all services configured', async () => {
            await SystemController.health(req, res);

            expect(res.json).toHaveBeenCalledWith({
                status: 'ok',
                message: 'System is healthy',
                timestamp: expect.any(String),
                version: expect.any(String),
                uptime: expect.any(Number),
                services: {
                    powerbi: 'configured',
                    openai: 'configured',
                    telemetry: 'enabled'
                }
            });
        });

        test('should show degraded status with partial configuration', async () => {
            const partialConfig = {
                powerBIGroupId: 'test-group-id'
                // Missing OpenAI config
            };
            configService.loadConfig.mockReturnValue(partialConfig);

            await SystemController.health(req, res);

            const call = res.json.mock.calls[0][0];
            expect(call.status).toBe('degraded');
            expect(call.message).toBe('System has configuration issues');
            expect(call.services.powerbi).toBe('partial');
            expect(call.services.openai).toBe('not configured');
        });

        test('should handle configuration loading errors', async () => {
            configService.loadConfig.mockImplementation(() => {
                throw new Error('Config load failed');
            });

            await SystemController.health(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(
                res,
                500,
                'Health check failed',
                'Config load failed'
            );
        });

        test('should include version from package.json when available', async () => {
            const mockPackageJson = JSON.stringify({ version: '1.2.3' });
            fs.readFile.mockResolvedValue(mockPackageJson);

            await SystemController.health(req, res);

            const call = res.json.mock.calls[0][0];
            expect(call.version).toBe('1.2.3');
        });

        test('should handle missing package.json gracefully', async () => {
            fs.readFile.mockRejectedValue(new Error('File not found'));

            await SystemController.health(req, res);

            const call = res.json.mock.calls[0][0];
            expect(call.version).toBe('unknown');
        });
    });

    describe('telemetryControl', () => {
        test('should enable telemetry successfully', async () => {
            req.body = { enabled: true };
            telemetry.setEnabled = jest.fn();

            await SystemController.telemetryControl(req, res);

            expect(telemetry.setEnabled).toHaveBeenCalledWith(true);
            expect(res.json).toHaveBeenCalledWith({
                status: 'success',
                message: 'Telemetry enabled',
                enabled: true,
                timestamp: expect.any(String)
            });
        });

        test('should disable telemetry successfully', async () => {
            req.body = { enabled: false };
            telemetry.setEnabled = jest.fn();

            await SystemController.telemetryControl(req, res);

            expect(telemetry.setEnabled).toHaveBeenCalledWith(false);
            expect(res.json).toHaveBeenCalledWith({
                status: 'success',
                message: 'Telemetry disabled',
                enabled: false,
                timestamp: expect.any(String)
            });
        });

        test('should handle missing enabled parameter', async () => {
            req.body = {};

            await SystemController.telemetryControl(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(
                res,
                400,
                'enabled parameter is required'
            );
        });

        test('should handle non-boolean enabled parameter', async () => {
            req.body = { enabled: 'yes' };

            await SystemController.telemetryControl(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(
                res,
                400,
                'enabled parameter must be a boolean'
            );
        });

        test('should handle telemetry service errors', async () => {
            req.body = { enabled: true };
            telemetry.setEnabled = jest.fn().mockImplementation(() => {
                throw new Error('Telemetry service error');
            });

            await SystemController.telemetryControl(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(
                res,
                500,
                'Failed to update telemetry settings',
                'Telemetry service error'
            );
        });
    });

    describe('getLogs', () => {
        const mockLogContent = `2024-01-01T10:00:00Z INFO Server started
2024-01-01T10:01:00Z DEBUG Chat request received
2024-01-01T10:02:00Z ERROR Failed to connect`;

        beforeEach(() => {
            fs.access.mockResolvedValue(undefined); // File exists
            fs.readFile.mockResolvedValue(mockLogContent);
        });

        test('should return logs with default parameters', async () => {
            await SystemController.getLogs(req, res);

            expect(fs.readFile).toHaveBeenCalledWith(
                expect.stringContaining('logs/telemetry.jsonl'),
                'utf8'
            );
            expect(res.json).toHaveBeenCalledWith({
                logs: mockLogContent.split('\n'),
                totalLines: 3,
                returnedLines: 3,
                source: 'telemetry.jsonl'
            });
        });

        test('should limit lines when specified', async () => {
            req.query.lines = '2';

            await SystemController.getLogs(req, res);

            const call = res.json.mock.calls[0][0];
            expect(call.returnedLines).toBe(2);
            expect(call.logs).toHaveLength(2);
        });

        test('should filter by log level', async () => {
            req.query.level = 'ERROR';

            await SystemController.getLogs(req, res);

            const call = res.json.mock.calls[0][0];
            expect(call.logs.some(line => line.includes('ERROR'))).toBe(true);
            expect(call.logs.every(line => line.includes('ERROR') || line.trim() === '')).toBe(true);
        });

        test('should handle custom log source', async () => {
            req.query.source = 'custom.log';

            await SystemController.getLogs(req, res);

            expect(fs.readFile).toHaveBeenCalledWith(
                expect.stringContaining('logs/custom.log'),
                'utf8'
            );
        });

        test('should handle missing log file', async () => {
            fs.access.mockRejectedValue(new Error('File not found'));

            await SystemController.getLogs(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(
                res,
                404,
                'Log file not found'
            );
        });

        test('should handle log file read errors', async () => {
            fs.readFile.mockRejectedValue(new Error('Permission denied'));

            await SystemController.getLogs(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(
                res,
                500,
                'Failed to read logs',
                'Permission denied'
            );
        });

        test('should validate log source for security', async () => {
            req.query.source = '../../../etc/passwd';

            await SystemController.getLogs(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(
                res,
                400,
                'Invalid log source'
            );
        });

        test('should handle invalid lines parameter', async () => {
            req.query.lines = 'not-a-number';

            await SystemController.getLogs(req, res);

            // Should default to all lines when invalid number provided
            const call = res.json.mock.calls[0][0];
            expect(call.returnedLines).toBe(3); // All lines
        });
    });

    describe('status', () => {
        test('should return comprehensive system status', async () => {
            const mockStats = {
                totalRequests: 100,
                totalErrors: 5,
                averageResponseTime: 250
            };
            telemetry.getStats = jest.fn().mockReturnValue(mockStats);

            await SystemController.status(req, res);

            expect(res.json).toHaveBeenCalledWith({
                status: 'operational',
                timestamp: expect.any(String),
                uptime: expect.any(Number),
                memory: expect.objectContaining({
                    used: expect.any(Number),
                    total: expect.any(Number),
                    percentage: expect.any(Number)
                }),
                statistics: mockStats,
                services: {
                    powerbi: 'configured',
                    openai: 'configured',
                    telemetry: 'enabled'
                }
            });
        });

        test('should handle telemetry stats errors gracefully', async () => {
            telemetry.getStats = jest.fn().mockImplementation(() => {
                throw new Error('Stats unavailable');
            });

            await SystemController.status(req, res);

            const call = res.json.mock.calls[0][0];
            expect(call.statistics).toEqual({
                error: 'Statistics unavailable'
            });
        });

        test('should calculate memory usage correctly', async () => {
            // Mock process.memoryUsage
            const originalMemoryUsage = process.memoryUsage;
            process.memoryUsage = jest.fn().mockReturnValue({
                rss: 100 * 1024 * 1024, // 100MB
                heapTotal: 80 * 1024 * 1024, // 80MB
                heapUsed: 60 * 1024 * 1024, // 60MB
                external: 10 * 1024 * 1024 // 10MB
            });

            await SystemController.status(req, res);

            const call = res.json.mock.calls[0][0];
            expect(call.memory.used).toBe(60); // MB
            expect(call.memory.total).toBe(80); // MB
            expect(call.memory.percentage).toBe(75); // 60/80 * 100

            // Restore original function
            process.memoryUsage = originalMemoryUsage;
        });
    });

    describe('error handling', () => {
        test('should handle general system errors', async () => {
            const systemError = new Error('System failure');
            configService.loadConfig.mockImplementation(() => {
                throw systemError;
            });

            await SystemController.health(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(
                res,
                500,
                'Health check failed',
                'System failure'
            );
        });

        test('should handle file system permission errors', async () => {
            fs.access.mockRejectedValue(new Error('EACCES: permission denied'));

            await SystemController.getLogs(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(
                res,
                500,
                'Failed to read logs',
                'EACCES: permission denied'
            );
        });
    });

    describe('service status detection', () => {
        test('should detect PowerBI service configuration levels', async () => {
            const testCases = [
                {
                    config: { powerBIGroupId: 'test', powerBIDatasetId: 'test' },
                    expected: 'configured'
                },
                {
                    config: { powerBIGroupId: 'test' },
                    expected: 'partial'
                },
                {
                    config: {},
                    expected: 'not configured'
                }
            ];

            for (const testCase of testCases) {
                configService.loadConfig.mockReturnValue(testCase.config);
                
                await SystemController.health(req, res);
                
                const call = res.json.mock.calls[res.json.mock.calls.length - 1][0];
                expect(call.services.powerbi).toBe(testCase.expected);
            }
        });

        test('should detect OpenAI service configuration', async () => {
            const configWithOpenAI = { openaiApiKey: 'test-key' };
            configService.loadConfig.mockReturnValue(configWithOpenAI);

            await SystemController.health(req, res);

            const call = res.json.mock.calls[0][0];
            expect(call.services.openai).toBe('configured');
        });
    });
});