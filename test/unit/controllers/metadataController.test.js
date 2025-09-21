const MetadataController = require('../../../src-v2/controllers/metadataController');
const PowerBIService = require('../../../src-v2/services/powerbiService');
const errorService = require('../../../src-v2/services/errorService');

// Mock dependencies
jest.mock('../../../src-v2/services/powerbiService');
jest.mock('../../../src-v2/services/errorService');
jest.mock('../../../src-v2/services/cacheService');

// Mock configService properly
jest.mock('../../../src-v2/services/configService', () => ({
    loadConfig: jest.fn(),
    validateConfig: jest.fn(),
    constants: {
        METADATA_CACHE_DURATION: 300000
    }
}));

const configService = require('../../../src-v2/services/configService');

describe('MetadataController', () => {
    let req, res;
    const mockConfig = {
        powerBIGroupId: 'test-group-id',
        powerBIDatasetId: 'test-dataset-id',
        powerBIReportId: 'test-report-id'
    };

    const mockMetadata = {
        dataset: { name: 'Test Dataset' },
        tables: [
            {
                name: 'Sales',
                columns: [
                    { name: 'Amount', dataType: 'Decimal' },
                    { name: 'Date', dataType: 'DateTime' }
                ]
            }
        ],
        measures: [
            { name: 'Total Sales', expression: 'SUM(Sales[Amount])' }
        ]
    };

    beforeEach(() => {
        jest.clearAllMocks();
        
        req = {
            query: {},
            method: 'GET',
            url: '/getDatasetMetadata'
        };
        
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            send: jest.fn(),
            setHeader: jest.fn()
        };

        // Mock services
        configService.loadConfig.mockReturnValue(mockConfig);
        errorService.sendError = jest.fn();
    });

    describe('getDatasetMetadata', () => {
        test('should successfully get metadata using config values', async () => {
            const mockPowerBIService = {
                getDatasetMetadata: jest.fn().mockResolvedValue(mockMetadata)
            };
            PowerBIService.mockImplementation(() => mockPowerBIService);

            await MetadataController.getDatasetMetadata(req, res);

            expect(configService.loadConfig).toHaveBeenCalledTimes(1);
            expect(PowerBIService).toHaveBeenCalledWith(mockConfig);
            expect(mockPowerBIService.getDatasetMetadata).toHaveBeenCalledWith(
                'test-group-id',
                'test-dataset-id'
            );
            expect(res.json).toHaveBeenCalledWith(mockMetadata);
            expect(errorService.sendError).not.toHaveBeenCalled();
        });

        test('should use query parameters when config values not available', async () => {
            const configWithoutIds = { powerBIReportId: 'test-report-id' };
            configService.loadConfig.mockReturnValue(configWithoutIds);
            
            req.query = {
                groupId: 'query-group-id',
                datasetId: 'query-dataset-id'
            };

            const mockPowerBIService = {
                getDatasetMetadata: jest.fn().mockResolvedValue(mockMetadata)
            };
            PowerBIService.mockImplementation(() => mockPowerBIService);

            await MetadataController.getDatasetMetadata(req, res);

            expect(mockPowerBIService.getDatasetMetadata).toHaveBeenCalledWith(
                'query-group-id',
                'query-dataset-id'
            );
        });

        test('should derive datasetId from reportId when datasetId missing', async () => {
            const configWithoutDatasetId = {
                powerBIGroupId: 'test-group-id',
                powerBIReportId: 'test-report-id'
            };
            configService.loadConfig.mockReturnValue(configWithoutDatasetId);

            const mockPowerBIService = {
                getDatasetIdFromReport: jest.fn().mockResolvedValue('derived-dataset-id'),
                getDatasetMetadata: jest.fn().mockResolvedValue(mockMetadata)
            };
            PowerBIService.mockImplementation(() => mockPowerBIService);

            await MetadataController.getDatasetMetadata(req, res);

            expect(mockPowerBIService.getDatasetIdFromReport).toHaveBeenCalledWith(
                'test-group-id',
                'test-report-id'
            );
            expect(mockPowerBIService.getDatasetMetadata).toHaveBeenCalledWith(
                'test-group-id',
                'derived-dataset-id'
            );
        });

        test('should return 400 error when groupId is missing', async () => {
            const configWithoutGroupId = { powerBIDatasetId: 'test-dataset-id' };
            configService.loadConfig.mockReturnValue(configWithoutGroupId);

            await MetadataController.getDatasetMetadata(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(res, 400, 'groupId is required');
        });

        test('should return 400 error when datasetId cannot be determined', async () => {
            const configWithoutDatasetId = { powerBIGroupId: 'test-group-id' };
            configService.loadConfig.mockReturnValue(configWithoutDatasetId);

            await MetadataController.getDatasetMetadata(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(res, 400, 'datasetId is required');
        });

        test('should handle datasetId derivation errors', async () => {
            const configWithoutDatasetId = {
                powerBIGroupId: 'test-group-id',
                powerBIReportId: 'test-report-id'
            };
            configService.loadConfig.mockReturnValue(configWithoutDatasetId);

            const derivationError = new Error('Report not found');
            const mockPowerBIService = {
                getDatasetIdFromReport: jest.fn().mockRejectedValue(derivationError)
            };
            PowerBIService.mockImplementation(() => mockPowerBIService);

            await MetadataController.getDatasetMetadata(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(
                res,
                400,
                'Could not determine dataset ID',
                'Report not found'
            );
        });

        test('should handle PowerBI service errors', async () => {
            const serviceError = new Error('PowerBI API error');
            const mockPowerBIService = {
                getDatasetMetadata: jest.fn().mockRejectedValue(serviceError)
            };
            PowerBIService.mockImplementation(() => mockPowerBIService);

            await MetadataController.getDatasetMetadata(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(
                res,
                500,
                'Failed to fetch dataset metadata',
                'PowerBI API error'
            );
        });
    });

    describe('getSimplifiedMetadata', () => {
        test('should return simplified metadata as plain text', async () => {
            const simplifiedText = 'Dataset: Test\nTables:\n- Sales\n  - Amount (Decimal)';
            const mockPowerBIService = {
                getSimplifiedMetadata: jest.fn().mockResolvedValue(simplifiedText)
            };
            PowerBIService.mockImplementation(() => mockPowerBIService);

            await MetadataController.getSimplifiedMetadata(req, res);

            expect(mockPowerBIService.getSimplifiedMetadata).toHaveBeenCalledWith(
                'test-group-id',
                'test-dataset-id'
            );
            expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain');
            expect(res.send).toHaveBeenCalledWith(simplifiedText);
        });

        test('should handle missing parameters in simplified metadata', async () => {
            const configWithoutGroupId = { powerBIDatasetId: 'test-dataset-id' };
            configService.loadConfig.mockReturnValue(configWithoutGroupId);

            await MetadataController.getSimplifiedMetadata(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(res, 400, 'groupId is required');
        });
    });

    describe('getNameOnlySchema', () => {
        test('should return schema as plain text', async () => {
            const schemaText = 'Sales.Amount [Decimal]\nSales.Date [DateTime]';
            const mockPowerBIService = {
                getNameOnlySchema: jest.fn().mockResolvedValue(schemaText)
            };
            PowerBIService.mockImplementation(() => mockPowerBIService);

            await MetadataController.getNameOnlySchema(req, res);

            expect(mockPowerBIService.getNameOnlySchema).toHaveBeenCalledWith(
                'test-group-id',
                'test-dataset-id'
            );
            expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain');
            expect(res.send).toHaveBeenCalledWith(schemaText);
        });
    });

    describe('clearCache', () => {
        test('should clear cache successfully', async () => {
            const mockCacheService = require('../../../src-v2/services/cacheService');
            mockCacheService.clearCache = jest.fn();

            await MetadataController.clearCache(req, res);

            expect(mockCacheService.clearCache).toHaveBeenCalledTimes(1);
            expect(res.json).toHaveBeenCalledWith({
                status: 'success',
                message: 'Metadata cache cleared',
                timestamp: expect.any(String)
            });
        });

        test('should handle cache clear errors', async () => {
            const mockCacheService = require('../../../src-v2/services/cacheService');
            mockCacheService.clearCache = jest.fn().mockImplementation(() => {
                throw new Error('Cache clear failed');
            });

            await MetadataController.clearCache(req, res);

            expect(errorService.sendError).toHaveBeenCalledWith(
                res,
                500,
                'Failed to clear cache',
                'Cache clear failed'
            );
        });
    });

    describe('healthCheck', () => {
        test('should return healthy status when properly configured', async () => {
            const mockCacheService = require('../../../src-v2/services/cacheService');
            mockCacheService.getCachedMetadata = jest.fn().mockReturnValue(mockMetadata);

            await MetadataController.healthCheck(req, res);

            expect(res.json).toHaveBeenCalledWith({
                status: 'ok',
                service: 'metadata',
                message: 'Metadata service ready',
                cache: {
                    enabled: true,
                    hasCachedData: true
                },
                timestamp: expect.any(String)
            });
        });

        test('should return error when groupId missing', async () => {
            const configWithoutGroupId = { powerBIDatasetId: 'test-dataset-id' };
            configService.loadConfig.mockReturnValue(configWithoutGroupId);

            await MetadataController.healthCheck(req, res);

            expect(res.json).toHaveBeenCalledWith({
                status: 'error',
                service: 'metadata',
                message: 'Missing powerBIGroupId configuration',
                timestamp: expect.any(String)
            });
        });

        test('should show cache status correctly', async () => {
            const mockCacheService = require('../../../src-v2/services/cacheService');
            mockCacheService.getCachedMetadata = jest.fn().mockReturnValue(null);

            await MetadataController.healthCheck(req, res);

            const call = res.json.mock.calls[0][0];
            expect(call.cache.hasCachedData).toBe(false);
        });
    });

    describe('parameter handling', () => {
        test('should prioritize config over query parameters', async () => {
            req.query = {
                groupId: 'query-group-id',
                datasetId: 'query-dataset-id'
            };

            const mockPowerBIService = {
                getDatasetMetadata: jest.fn().mockResolvedValue(mockMetadata)
            };
            PowerBIService.mockImplementation(() => mockPowerBIService);

            await MetadataController.getDatasetMetadata(req, res);

            // Should use config values, not query values
            expect(mockPowerBIService.getDatasetMetadata).toHaveBeenCalledWith(
                'test-group-id',
                'test-dataset-id'
            );
        });

        test('should handle partial config with query fallback', async () => {
            const partialConfig = { powerBIGroupId: 'config-group-id' };
            configService.loadConfig.mockReturnValue(partialConfig);
            
            req.query = { datasetId: 'query-dataset-id' };

            const mockPowerBIService = {
                getDatasetMetadata: jest.fn().mockResolvedValue(mockMetadata)
            };
            PowerBIService.mockImplementation(() => mockPowerBIService);

            await MetadataController.getDatasetMetadata(req, res);

            expect(mockPowerBIService.getDatasetMetadata).toHaveBeenCalledWith(
                'config-group-id',
                'query-dataset-id'
            );
        });
    });
});