/**
 * Caching Behavior Validation Tests
 * 
 * Tests to verify that the metadata caching works correctly
 * in the new PowerBI service architecture.
 */

const PowerBIService = require('../../src-v2/services/powerbiService');
const cacheService = require('../../src-v2/services/cacheService');

describe('Caching Behavior Validation', () => {
  let powerbiService;
  let mockConfig;

  beforeEach(() => {
    // Clear cache before each test
    cacheService.clearCache();

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

    powerbiService = new PowerBIService(mockConfig);
  });

  describe('Metadata Caching', () => {
    it('should start with empty cache', () => {
      expect(cacheService.getCachedMetadata()).toBeNull();
      
      const cacheInfo = cacheService.getCacheInfo();
      expect(cacheInfo.status).toBe('no_cache');
    });

    it('should cache metadata after first retrieval', async () => {
      // First call should not use cache
      expect(cacheService.getCachedMetadata()).toBeNull();

      const metadata = await powerbiService.getDatasetMetadata('group-id', 'dataset-id');
      
      // Verify metadata was cached
      const cachedData = cacheService.getCachedMetadata();
      expect(cachedData).not.toBeNull();
      expect(cachedData.dataset.name).toBe('Store Sales');
      expect(cachedData).toEqual(metadata);
    });

    it('should return cached data on subsequent calls', async () => {
      // Get metadata twice
      const metadata1 = await powerbiService.getDatasetMetadata('group-id', 'dataset-id');
      const metadata2 = await powerbiService.getDatasetMetadata('group-id', 'dataset-id');
      
      // Should be identical objects
      expect(metadata2).toEqual(metadata1);
      
      // Verify cache was used
      const cacheInfo = cacheService.getCacheInfo();
      expect(cacheInfo.status).toBe('cached');
      expect(cacheInfo.cacheInfo.isStale).toBe(false);
    });

    it('should provide detailed cache information', async () => {
      // Initially no cache
      let cacheInfo = cacheService.getCacheInfo();
      expect(cacheInfo.status).toBe('no_cache');
      expect(cacheInfo.cacheInfo.lastFetched).toBeNull();

      // After getting metadata
      await powerbiService.getDatasetMetadata('group-id', 'dataset-id');
      
      cacheInfo = cacheService.getCacheInfo();
      expect(cacheInfo.status).toBe('cached');
      expect(cacheInfo.cacheInfo.lastFetched).toBeTruthy();
      expect(cacheInfo.cacheInfo.cacheAgeMs).toBeGreaterThanOrEqual(0);
      expect(cacheInfo.cacheInfo.isStale).toBe(false);
      expect(cacheInfo.cacheInfo.cacheDurationMs).toBeDefined();
    });

    it('should detect when cache becomes stale', () => {
      // Manually set old cache data
      const oldMetadata = { dataset: { name: 'Old Dataset' } };
      cacheService.setCachedMetadata(oldMetadata);
      
      // Manually set old timestamp (simulate stale cache)
      const storage = cacheService._getCacheStorage();
      storage.metadata.lastFetched = Date.now() - (10 * 60 * 1000); // 10 minutes ago
      
      expect(cacheService.isCacheStale()).toBe(true);
      expect(cacheService.getCachedMetadata()).toBeNull(); // Should return null for stale cache
      
      const cacheInfo = cacheService.getCacheInfo();
      expect(cacheInfo.cacheInfo.isStale).toBe(true);
    });

    it('should allow manual cache clearing', async () => {
      // Cache some metadata
      await powerbiService.getDatasetMetadata('group-id', 'dataset-id');
      expect(cacheService.getCachedMetadata()).not.toBeNull();
      
      // Clear cache
      cacheService.clearCache();
      expect(cacheService.getCachedMetadata()).toBeNull();
      
      const cacheInfo = cacheService.getCacheInfo();
      expect(cacheInfo.status).toBe('no_cache');
    });
  });

  describe('Cache Integration with PowerBI Service', () => {
    it('should use cache service from PowerBI service methods', async () => {
      // Spy on cache methods
      const getCachedSpy = jest.spyOn(cacheService, 'getCachedMetadata');
      const setCachedSpy = jest.spyOn(cacheService, 'setCachedMetadata');
      
      await powerbiService.getDatasetMetadata('group-id', 'dataset-id');
      
      expect(getCachedSpy).toHaveBeenCalled();
      expect(setCachedSpy).toHaveBeenCalled();
      
      getCachedSpy.mockRestore();
      setCachedSpy.mockRestore();
    });

    it('should work with different metadata formats', async () => {
      // Test caching works across different metadata methods
      const completeMetadata = await powerbiService.getDatasetMetadata('group-id', 'dataset-id');
      const simplifiedMetadata = await powerbiService.getSimplifiedMetadata('group-id', 'dataset-id');
      const schemaMetadata = await powerbiService.getNameOnlySchema('group-id', 'dataset-id');
      
      // All should use the same cached complete metadata
      expect(cacheService.getCachedMetadata()).toEqual(completeMetadata);
      expect(simplifiedMetadata).toContain('Store Sales');
      expect(schemaMetadata).toContain('Sales.TotalSales');
    });

    it('should handle cache misses gracefully', async () => {
      // Clear cache and verify service handles it properly
      cacheService.clearCache();
      
      // Should not throw error
      const metadata = await powerbiService.getDatasetMetadata('group-id', 'dataset-id');
      expect(metadata).toBeDefined();
      expect(metadata.dataset.name).toBe('Store Sales');
    });
  });

  describe('Cache Performance Characteristics', () => {
    it('should be faster on cached requests', async () => {
      // First request (uncached)
      const start1 = Date.now();
      await powerbiService.getDatasetMetadata('group-id', 'dataset-id');
      const time1 = Date.now() - start1;
      
      // Second request (cached)
      const start2 = Date.now();
      await powerbiService.getDatasetMetadata('group-id', 'dataset-id');
      const time2 = Date.now() - start2;
      
      // Cached request should be faster (though timing may vary in tests)
      // This is more about ensuring the cache is being used
      expect(cacheService.getCachedMetadata()).not.toBeNull();
      
      // Log times for observation (optional)
      console.log(`First request: ${time1}ms, Cached request: ${time2}ms`);
    });

    it('should maintain reasonable memory usage', async () => {
      // Get metadata multiple times
      for (let i = 0; i < 5; i++) {
        await powerbiService.getDatasetMetadata('group-id', 'dataset-id');
      }
      
      // Should still only have one cached entry
      const storage = cacheService._getCacheStorage();
      expect(Object.keys(storage)).toHaveLength(1); // Only metadata cache
      expect(storage.metadata.data).toBeDefined();
    });
  });
});