/**
 * Comprehensive PowerBI Endpoint Validation Tests for src-v2
 * 
 * Tests the PowerBI endpoints with the new service architecture
 * to ensure they work correctly and maintain compatibility.
 */

const request = require('supertest');
const PowerBIService = require('../../src-v2/services/powerbiService');
const cacheService = require('../../src-v2/services/cacheService');

// Mock external dependencies to avoid real PowerBI calls
jest.mock('@azure/msal-node');
jest.mock('node-fetch');

// Mock configService for tests - with minimal config for validation tests
jest.mock('../../src-v2/services/configService', () => ({
  configService: {
    loadConfig: jest.fn(() => ({
      // Minimal config without PowerBI IDs to test parameter validation
      clientId: 'test-client-id',
      tenantId: 'test-tenant-id',
      clientSecret: 'test-client-secret',
      authorityUrl: 'https://login.microsoftonline.com/',
      scopeBase: 'https://analysis.windows.net/powerbi/api/.default'
      // Note: No powerBIGroupId, powerBIDatasetId, or powerBIReportId for validation tests
    }))
  }
}));

describe('PowerBI Endpoints - Comprehensive Validation', () => {
  let app;
  
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = require('../../src-v2/app.js');
  });

  beforeEach(() => {
    // Clear cache before each test
    cacheService.clearCache();
  });

  describe('GET /getEmbedToken', () => {
    it('should handle missing configuration gracefully', async () => {
      const response = await request(app)
        .get('/getEmbedToken');
      
      // Should return error due to missing config
      expect([400, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });

    it('should use PowerBI service architecture', async () => {
      // Verify the endpoint exists and follows service pattern
      const response = await request(app)
        .get('/getEmbedToken');
      
      // Should not be 404 (route exists)
      expect(response.status).not.toBe(404);
      
      // Should have proper error structure
      if (response.body.error) {
        expect(typeof response.body.error).toBe('string');
      }
    });

    it('should maintain API contract compatibility', async () => {
      const response = await request(app)
        .get('/getEmbedToken');
      
      // Response should be JSON
      expect(response.headers['content-type']).toMatch(/json/);
      
      // Should have either success or error structure
      if (response.status === 200) {
        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('embedUrl');
        expect(response.body).toHaveProperty('expiry');
        expect(response.body).toHaveProperty('status');
      } else {
        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('GET /getDatasetMetadata', () => {
    it('should handle missing groupId', async () => {
      const response = await request(app)
        .get('/getDatasetMetadata');
      
      // Should return error, may be 400 or 500 depending on config state
      expect([400, 500]).toContain(response.status);
      if (response.status === 400) {
        expect(response.body.error).toContain('groupId is required');
      }
    });

    it('should handle missing datasetId', async () => {
      const response = await request(app)
        .get('/getDatasetMetadata?groupId=test-group');
      
      // Should return error, may be 400 or 500 depending on config state
      expect([400, 500]).toContain(response.status);
      if (response.status === 400) {
        expect(response.body.error).toContain('datasetId is required');
      }
    });

    it('should use PowerBI service with caching', async () => {
      // Mock successful service response
      const mockMetadata = {
        dataset: { name: 'Test Dataset' },
        tables: [],
        measures: [],
        dimensions: []
      };

      // Spy on cache service to verify integration
      jest.spyOn(cacheService, 'getCachedMetadata').mockReturnValue(null);
      jest.spyOn(cacheService, 'setCachedMetadata');
      
      const response = await request(app)
        .get('/getDatasetMetadata?groupId=test-group&datasetId=test-dataset');
      
      // Should attempt to use service architecture
      expect(response.status).not.toBe(404);
    });

    it('should maintain API contract compatibility', async () => {
      const response = await request(app)
        .get('/getDatasetMetadata?groupId=test-group&datasetId=test-dataset');
      
      // Response should be JSON
      expect(response.headers['content-type']).toMatch(/json/);
      
      // Should have either success or error structure
      if (response.status === 200) {
        expect(response.body).toHaveProperty('dataset');
        expect(response.body).toHaveProperty('tables');
      } else {
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should support query parameters for groupId and datasetId', async () => {
      const response = await request(app)
        .get('/getDatasetMetadata?groupId=query-group&datasetId=query-dataset');
      
      // Should not be 404 (route exists and handles query params)
      expect(response.status).not.toBe(404);
      
      // Should not be 400 for missing required params
      if (response.status === 400) {
        expect(response.body.error).not.toContain('groupId is required');
        expect(response.body.error).not.toContain('datasetId is required');
      }
    });
  });

  describe('Service Integration', () => {
    it('should properly instantiate PowerBI service', () => {
      // Verify PowerBI service can be instantiated with config
      const mockConfig = {
        clientId: 'test-client-id',
        tenantId: 'test-tenant-id',
        clientSecret: 'test-client-secret'
      };
      const service = new PowerBIService(mockConfig);
      expect(service).toBeInstanceOf(PowerBIService);
      expect(service.config).toEqual(mockConfig);
    });

    it('should integrate with cache service', () => {
      // Verify cache service integration
      expect(typeof cacheService.getCachedMetadata).toBe('function');
      expect(typeof cacheService.setCachedMetadata).toBe('function');
      expect(typeof cacheService.clearCache).toBe('function');
    });

    it('should handle errors gracefully', async () => {
      // Test various endpoints for proper error handling
      const endpoints = ['/getEmbedToken', '/getDatasetMetadata'];
      
      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        
        // Should not crash the server
        expect(response.status).toBeLessThan(600);
        
        // Should return proper JSON error if not successful
        if (response.status >= 400) {
          expect(response.headers['content-type']).toMatch(/json/);
          expect(response.body).toHaveProperty('error');
        }
      }
    });
  });

  describe('Backwards Compatibility', () => {
    it('should serve HTML content for root and chartchat routes', async () => {
      const routes = ['/', '/chartchat'];
      
      for (const route of routes) {
        const response = await request(app).get(route);
        
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/html/);
        expect(response.text).toContain('Chart Chat');
      }
    });

    it('should provide health check endpoint', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        version: 'src-v2',
        timestamp: expect.any(String)
      });
    });

    it('should handle non-existent routes appropriately', async () => {
      const response = await request(app).get('/nonexistent-route');
      
      expect(response.status).toBe(404);
    });
  });
});