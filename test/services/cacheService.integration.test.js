/**
 * Integration test to verify cacheService behavior matches 
 * current global state behavior in routes.js
 */

const cacheService = require('../../src-v2/services/cacheService');

describe('CacheService - Behavior Compatibility', () => {
  beforeEach(() => {
    cacheService.clearCache();
  });

  describe('Metadata caching workflow', () => {
    test('should replicate /getDatasetMetadata caching logic', () => {
      const mockMetadata = {
        dataset: { name: 'Sales Dataset', id: 'abc123' },
        tables: [{ name: 'Sales' }]
      };

      // Simulate first request - no cache
      let cachedData = cacheService.getCachedMetadata();
      expect(cachedData).toBeNull();

      // Simulate storing fetched data
      cacheService.setCachedMetadata(mockMetadata);

      // Simulate second request - should return cached data
      cachedData = cacheService.getCachedMetadata();
      expect(cachedData).toEqual(mockMetadata);

      // Verify cache is not stale immediately
      expect(cacheService.isCacheStale()).toBe(false);
    });

    test('should replicate /debug/metadata endpoint logic', () => {
      // Test no cache scenario
      let cacheInfo = cacheService.getCacheInfo();
      expect(cacheInfo).toEqual({
        status: 'no_cache',
        message: 'No metadata cached yet',
        cacheInfo: { lastFetched: null, cacheAge: null }
      });

      // Add some cached data
      const mockMetadata = { dataset: { name: 'Test Dataset' } };
      cacheService.setCachedMetadata(mockMetadata);

      // Test cached scenario
      cacheInfo = cacheService.getCacheInfo();
      expect(cacheInfo.status).toBe('cached');
      expect(cacheInfo.cacheInfo.lastFetched).toBeDefined();
      expect(cacheInfo.cacheInfo.cacheAgeMs).toBeGreaterThanOrEqual(0);
      expect(cacheInfo.cacheInfo.isStale).toBe(false);
      expect(cacheInfo.cacheInfo.cacheDurationMs).toBe(5 * 60 * 1000);
    });

    test('should handle cache expiration like current implementation', () => {
      const mockMetadata = { dataset: { name: 'Test Dataset' } };
      
      // Cache some data
      cacheService.setCachedMetadata(mockMetadata);
      
      // Verify fresh cache works
      expect(cacheService.getCachedMetadata()).toEqual(mockMetadata);
      
      // Manually expire cache (simulate 6 minutes passing)
      const storage = cacheService._getCacheStorage();
      storage.metadata.lastFetched = Date.now() - (6 * 60 * 1000);
      
      // Verify expired cache behavior
      expect(cacheService.getCachedMetadata()).toBeNull();
      expect(cacheService.isCacheStale()).toBe(true);
      
      // Cache info should still show the stale cache exists
      const cacheInfo = cacheService.getCacheInfo();
      expect(cacheInfo.status).toBe('cached');
      expect(cacheInfo.cacheInfo.isStale).toBe(true);
    });
  });

  describe('Performance characteristics', () => {
    test('should be fast for cache hit operations', () => {
      const mockMetadata = { 
        dataset: { name: 'Large Dataset' },
        tables: new Array(100).fill(0).map((_, i) => ({ name: `Table${i}` }))
      };
      
      cacheService.setCachedMetadata(mockMetadata);
      
      // Multiple cache hits should be fast
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        cacheService.getCachedMetadata();
      }
      const duration = Date.now() - start;
      
      // Should complete 1000 cache hits in under 100ms
      expect(duration).toBeLessThan(100);
    });

    test('should handle multiple rapid cache updates', () => {
      // Simulate rapid updates (shouldn't cause issues)
      for (let i = 0; i < 10; i++) {
        cacheService.setCachedMetadata({ iteration: i });
      }
      
      const result = cacheService.getCachedMetadata();
      expect(result.iteration).toBe(9); // Last update wins
    });
  });
});