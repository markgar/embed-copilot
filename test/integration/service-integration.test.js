/**
 * Service Integration Test - Validates that errorService and cacheService
 * work together correctly as a foundation for the service architecture
 */

const express = require('express');
const request = require('supertest');
const errorService = require('../../src-v2/services/errorService');
const cacheService = require('../../src-v2/services/cacheService');

describe('Service Integration - errorService + cacheService', () => {
  let app;

  beforeAll(() => {
    // Create test app that uses both services together
    app = express();
    app.use(express.json());

    // Simulate a metadata endpoint that uses both services
    app.get('/test-metadata', (req, res) => {
      try {
        // Check cache first
        const cachedData = cacheService.getCachedMetadata();
        if (cachedData) {
          return errorService.success(res, cachedData);
        }

        // Simulate fetching new data
        const newData = { dataset: { name: 'Test Dataset', id: '123' } };
        cacheService.setCachedMetadata(newData);
        
        return errorService.success(res, newData);
      } catch (error) {
        return errorService.handleError(res, error, 'Failed to get metadata');
      }
    });

    // Simulate cache info endpoint
    app.get('/test-cache-info', (req, res) => {
      try {
        const cacheInfo = cacheService.getCacheInfo();
        return errorService.success(res, cacheInfo);
      } catch (error) {
        return errorService.handleError(res, error, 'Failed to get cache info');
      }
    });

    // Simulate error scenarios
    app.get('/test-error', (req, res) => {
      const type = req.query.type;
      
      if (type === 'bad-request') {
        return errorService.badRequest(res, 'Invalid parameters', 'Missing required field');
      } else if (type === 'server-error') {
        return errorService.serverError(res, 'Database connection failed');
      } else if (type === 'not-found') {
        return errorService.notFound(res, 'Resource not found');
      } else {
        return errorService.badRequest(res, 'Invalid error type');
      }
    });
  });

  beforeEach(() => {
    // Clear cache before each test
    cacheService.clearCache();
  });

  describe('Metadata endpoint with caching', () => {
    test('should return new data and cache it on first request', async () => {
      const response = await request(app)
        .get('/test-metadata')
        .expect(200);

      expect(response.body).toEqual({
        dataset: { name: 'Test Dataset', id: '123' }
      });

      // Verify data was cached
      const cachedData = cacheService.getCachedMetadata();
      expect(cachedData).toEqual(response.body);
    });

    test('should return cached data on second request', async () => {
      // First request
      await request(app)
        .get('/test-metadata')
        .expect(200);

      // Second request should return same data from cache
      const response2 = await request(app)
        .get('/test-metadata')
        .expect(200);

      expect(response2.body).toEqual({
        dataset: { name: 'Test Dataset', id: '123' }
      });
    });

    test('should return fresh data when cache is cleared', async () => {
      // First request
      await request(app)
        .get('/test-metadata')
        .expect(200);

      // Clear cache
      cacheService.clearCache();

      // Next request should fetch new data
      const response = await request(app)
        .get('/test-metadata')
        .expect(200);

      expect(response.body).toEqual({
        dataset: { name: 'Test Dataset', id: '123' }
      });
    });
  });

  describe('Cache info endpoint', () => {
    test('should return no_cache status when no cache exists', async () => {
      const response = await request(app)
        .get('/test-cache-info')
        .expect(200);

      expect(response.body).toEqual({
        status: 'no_cache',
        message: 'No metadata cached yet',
        cacheInfo: { lastFetched: null, cacheAge: null }
      });
    });

    test('should return cached status when cache exists', async () => {
      // Create some cached data
      await request(app)
        .get('/test-metadata')
        .expect(200);

      const response = await request(app)
        .get('/test-cache-info')
        .expect(200);

      expect(response.body.status).toBe('cached');
      expect(response.body.cacheInfo).toBeDefined();
      expect(response.body.cacheInfo.lastFetched).toBeDefined();
      expect(response.body.cacheInfo.isStale).toBe(false);
    });
  });

  describe('Error handling integration', () => {
    test('should handle bad request errors consistently', async () => {
      const response = await request(app)
        .get('/test-error?type=bad-request')
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid parameters',
        details: 'Missing required field'
      });
    });

    test('should handle server errors consistently', async () => {
      const response = await request(app)
        .get('/test-error?type=server-error')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Database connection failed'
      });
    });

    test('should handle not found errors consistently', async () => {
      const response = await request(app)
        .get('/test-error?type=not-found')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Resource not found'
      });
    });
  });

  describe('Service architecture validation', () => {
    test('should maintain service independence', () => {
      // Services should work independently
      expect(typeof errorService.badRequest).toBe('function');
      expect(typeof cacheService.getCachedMetadata).toBe('function');
      
      // Services should not have direct dependencies on each other
      expect(cacheService.getCachedMetadata()).toBeNull(); // Fresh state
      expect(errorService.success).toBeDefined(); // Available
    });

    test('should support concurrent operations', async () => {
      // Multiple concurrent requests should work
      const promises = Array.from({ length: 5 }, () =>
        request(app).get('/test-metadata').expect(200)
      );

      const responses = await Promise.all(promises);
      
      // All should return the same cached data
      const expectedData = { dataset: { name: 'Test Dataset', id: '123' } };
      responses.forEach(response => {
        expect(response.body).toEqual(expectedData);
      });
    });
  });

  afterAll(() => {
    // Clean up
    cacheService.clearCache();
  });
});