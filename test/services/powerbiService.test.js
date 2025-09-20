/**
 * Unit tests for PowerBI Service
 */

const PowerBIService = require('../../src-v2/services/powerbiService');
const configService = require('../../src-v2/services/configService');
const cacheService = require('../../src-v2/services/cacheService');
const errorService = require('../../src-v2/services/errorService');
const msal = require("@azure/msal-node");
const fetch = require('node-fetch');

// Mock external dependencies
jest.mock('@azure/msal-node');
jest.mock('node-fetch');
jest.mock('../../src-v2/services/cacheService');

// Mock configService
jest.mock('../../src-v2/services/configService', () => ({
    loadConfig: jest.fn(),
    validateConfig: jest.fn(),
    constants: { METADATA_CACHE_DURATION: 300000 }
}));

describe('PowerBIService', () => {
    let powerbiService;
    let mockConfig;
    let mockMsalApp;
    let mockToken;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Mock configuration
        mockConfig = {
            clientId: 'test-client-id',
            tenantId: 'test-tenant-id',
            clientSecret: 'test-client-secret',
            authorityUrl: 'https://login.microsoftonline.com/',
            scopeBase: 'https://analysis.windows.net/powerbi/api/.default',
            powerBIGroupId: 'test-group-id',
            powerBIReportId: 'test-report-id'
        };

        // Mock MSAL token response
        mockToken = {
            accessToken: 'mock-access-token',
            expiresOn: new Date(Date.now() + 3600000),
            scopes: ['https://analysis.windows.net/powerbi/api/.default']
        };

        // Mock MSAL client application
        mockMsalApp = {
            acquireTokenByClientCredential: jest.fn().mockResolvedValue(mockToken)
        };
        msal.ConfidentialClientApplication = jest.fn().mockReturnValue(mockMsalApp);

        // Initialize service with mock config
        powerbiService = new PowerBIService(mockConfig);
    });

    describe('constructor', () => {
        it('should initialize with provided config', () => {
            const service = new PowerBIService(mockConfig);
            expect(service.config).toEqual(mockConfig);
        });

        it('should load config from configService if not provided', () => {
            configService.loadConfig.mockReturnValue(mockConfig);
            
            const service = new PowerBIService();
            expect(service.config).toEqual(mockConfig);
            expect(configService.loadConfig).toHaveBeenCalled();
        });
    });

    describe('getAccessToken', () => {
        it('should successfully get access token with correct configuration', async () => {
            const token = await powerbiService.getAccessToken();

            expect(msal.ConfidentialClientApplication).toHaveBeenCalledWith({
                auth: {
                    clientId: mockConfig.clientId,
                    authority: `${mockConfig.authorityUrl}${mockConfig.tenantId}`,
                    clientSecret: mockConfig.clientSecret
                }
            });

            expect(mockMsalApp.acquireTokenByClientCredential).toHaveBeenCalledWith({
                scopes: [mockConfig.scopeBase]
            });

            expect(token).toEqual(mockToken);
        });

        it('should handle authentication errors', async () => {
            const authError = new Error('Authentication failed');
            mockMsalApp.acquireTokenByClientCredential.mockRejectedValue(authError);

            await expect(powerbiService.getAccessToken()).rejects.toThrow('Authentication failed');
        });
    });

    describe('getRequestHeader', () => {
        it('should return correct headers with Bearer token', async () => {
            const headers = await powerbiService.getRequestHeader();

            expect(headers).toEqual({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${mockToken.accessToken}`
            });
        });

        it('should handle authentication errors with proper error message', async () => {
            const authError = {
                error: 'invalid_client',
                error_description: 'Invalid client credentials'
            };
            mockMsalApp.acquireTokenByClientCredential.mockRejectedValue(authError);

            await expect(powerbiService.getRequestHeader()).rejects.toThrow(
                'Authentication failed: Invalid client credentials'
            );
        });

        it('should handle generic errors', async () => {
            const genericError = new Error('Network error');
            mockMsalApp.acquireTokenByClientCredential.mockRejectedValue(genericError);

            await expect(powerbiService.getRequestHeader()).rejects.toThrow(
                'Authentication failed: Error: Network error'
            );
        });
    });

    describe('getEmbedInfo', () => {
        let mockReportResponse;

        beforeEach(() => {
            mockReportResponse = {
                id: 'test-report-id',
                name: 'Test Report',
                embedUrl: 'https://app.powerbi.com/reportEmbed',
                datasetId: 'test-dataset-id'
            };

            // Mock successful fetch responses
            fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue(mockReportResponse)
            });
        });

        it('should return embed info successfully', async () => {
            // Mock getEmbedTokenForSingleReport method
            const mockEmbedToken = {
                token: 'mock-embed-token',
                expiration: '2024-01-01T12:00:00Z'
            };

            jest.spyOn(powerbiService, 'getEmbedTokenForSingleReport')
                .mockResolvedValue(mockEmbedToken);

            const embedInfo = await powerbiService.getEmbedInfo();

            expect(embedInfo).toEqual({
                accessToken: mockEmbedToken.token,
                embedUrl: [{
                    id: mockReportResponse.id,
                    name: mockReportResponse.name,
                    embedUrl: mockReportResponse.embedUrl
                }],
                expiry: mockEmbedToken.expiration,
                status: 200
            });
        });

        it('should handle API errors properly', async () => {
            const apiError = {
                status: 404,
                statusText: 'Not Found',
                json: jest.fn().mockResolvedValue({ error: 'Report not found' }),
                headers: { get: jest.fn().mockReturnValue('request-id-123') }
            };

            jest.spyOn(powerbiService, 'getEmbedParamsForSingleReport')
                .mockRejectedValue(apiError);

            const result = await powerbiService.getEmbedInfo();

            expect(result.status).toBe(404);
            expect(result.error).toContain('Error while retrieving report embed details');
        });
    });

    describe('getEmbedParamsForSingleReport', () => {
        let mockReportResponse;

        beforeEach(() => {
            mockReportResponse = {
                id: 'test-report-id',
                name: 'Test Report',
                embedUrl: 'https://app.powerbi.com/reportEmbed',
                datasetId: 'test-dataset-id'
            };

            fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue(mockReportResponse)
            });
        });

        it('should get embed params for single report', async () => {
            const mockEmbedToken = {
                token: 'mock-embed-token',
                expiration: '2024-01-01T12:00:00Z'
            };

            jest.spyOn(powerbiService, 'getEmbedTokenForSingleReport')
                .mockResolvedValue(mockEmbedToken);

            const params = await powerbiService.getEmbedParamsForSingleReport(
                'workspace-id',
                'report-id'
            );

            expect(fetch).toHaveBeenCalledWith(
                'https://api.powerbi.com/v1.0/myorg/groups/workspace-id/reports/report-id',
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${mockToken.accessToken}`
                    }
                }
            );

            expect(params.reportsDetail).toEqual([{
                id: mockReportResponse.id,
                name: mockReportResponse.name,
                embedUrl: mockReportResponse.embedUrl
            }]);

            expect(params.embedToken).toEqual(mockEmbedToken);
        });

        it('should handle additional dataset ID', async () => {
            const mockEmbedToken = { token: 'token', expiration: 'expiry' };
            jest.spyOn(powerbiService, 'getEmbedTokenForSingleReport')
                .mockResolvedValue(mockEmbedToken);

            await powerbiService.getEmbedParamsForSingleReport(
                'workspace-id',
                'report-id',
                'additional-dataset-id'
            );

            expect(powerbiService.getEmbedTokenForSingleReport).toHaveBeenCalledWith(
                'report-id',
                ['test-dataset-id', 'additional-dataset-id'],
                'workspace-id'
            );
        });

        it('should throw error for failed API call', async () => {
            fetch.mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found'
            });

            await expect(
                powerbiService.getEmbedParamsForSingleReport('workspace-id', 'report-id')
            ).rejects.toEqual({
                ok: false,
                status: 404,
                statusText: 'Not Found'
            });
        });
    });

    describe('getDatasetIdFromReport', () => {
        it('should return dataset ID from report', async () => {
            const mockResponse = {
                id: 'report-id',
                datasetId: 'dataset-id-123'
            };

            fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue(mockResponse)
            });

            const datasetId = await powerbiService.getDatasetIdFromReport(
                'group-id',
                'report-id'
            );

            expect(datasetId).toBe('dataset-id-123');
            expect(fetch).toHaveBeenCalledWith(
                'https://api.powerbi.com/v1.0/myorg/groups/group-id/reports/report-id',
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${mockToken.accessToken}`
                    }
                }
            );
        });

        it('should handle API errors', async () => {
            fetch.mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found'
            });

            await expect(
                powerbiService.getDatasetIdFromReport('group-id', 'report-id')
            ).rejects.toThrow('Failed to get report details: 404 Not Found');
        });
    });

    describe('getDatasetMetadata', () => {
        it('should return cached metadata if available', async () => {
            const cachedMetadata = { dataset: { name: 'Cached Dataset' } };
            cacheService.getCachedMetadata.mockReturnValue(cachedMetadata);

            const result = await powerbiService.getDatasetMetadata('group-id', 'dataset-id');

            expect(result).toEqual(cachedMetadata);
            expect(cacheService.getCachedMetadata).toHaveBeenCalled();
        });

        it('should fetch and cache metadata if not cached', async () => {
            cacheService.getCachedMetadata.mockReturnValue(null);
            
            const result = await powerbiService.getDatasetMetadata('group-id', 'dataset-id');

            expect(result.dataset.name).toBe('Store Sales');
            expect(result.tables).toHaveLength(5);
            expect(result.measures).toHaveLength(2);
            expect(result.dimensions).toHaveLength(17);
            expect(cacheService.setCachedMetadata).toHaveBeenCalledWith(result);
        });
    });

    describe('getSimplifiedMetadata', () => {
        it('should return formatted metadata string', async () => {
            cacheService.getCachedMetadata.mockReturnValue(null);

            const result = await powerbiService.getSimplifiedMetadata('group-id', 'dataset-id');

            expect(result).toContain('Dataset: Store Sales');
            expect(result).toContain('Tables:');
            expect(result).toContain('- Sales (fact):');
            expect(result).toContain('Measures:');
            expect(result).toContain('Dimensions:');
        });
    });

    describe('getNameOnlySchema', () => {
        it('should return schema in table.column format', async () => {
            cacheService.getCachedMetadata.mockReturnValue(null);

            const result = await powerbiService.getNameOnlySchema('group-id', 'dataset-id');

            expect(result).toContain('Sales.TotalUnits [number]');
            expect(result).toContain('Time.Month [date]');
            expect(result).toContain('Store.Territory [geography]');
        });
    });
});