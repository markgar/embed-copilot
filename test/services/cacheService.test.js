/**
 * Unit tests for cacheService.js
 * Tests shared caching logic and state management
 */

const cacheService = require('../../src-v2/services/cacheService');

describe('CacheService', () => {
  beforeEach(() => {
    // Clear cache before each test
    cacheService.clearCache();
  });

  describe('getCachedMetadata', () => {
    test('should return null when no metadata is cached', () => {
      const result = cacheService.getCachedMetadata();
      expect(result).toBeNull();
    });

    test('should return cached metadata when fresh', () => {
      const metadata = { dataset: { name: 'Test Dataset' } };
      cacheService.setCachedMetadata(metadata);
      
      const result = cacheService.getCachedMetadata();
      expect(result).toEqual(metadata);
    });

    test('should return null when metadata is stale', () => {
      const metadata = { dataset: { name: 'Test Dataset' } };
      
      // Manually set stale cache by manipulating internal storage
      const storage = cacheService._getCacheStorage();
      storage.metadata.data = metadata;
      storage.metadata.lastFetched = Date.now() - (6 * 60 * 1000); // 6 minutes ago (stale)
      
      const result = cacheService.getCachedMetadata();
      expect(result).toBeNull();
    });
  });

  describe('setCachedMetadata', () => {
    test('should store metadata with current timestamp', () => {
      const metadata = { dataset: { name: 'Test Dataset' } };
      const beforeTime = Date.now();
      
      cacheService.setCachedMetadata(metadata);
      
      const afterTime = Date.now();
      const storage = cacheService._getCacheStorage();
      
      expect(storage.metadata.data).toEqual(metadata);
      expect(storage.metadata.lastFetched).toBeGreaterThanOrEqual(beforeTime);
      expect(storage.metadata.lastFetched).toBeLessThanOrEqual(afterTime);
    });

    test('should overwrite existing cached metadata', () => {
      const metadata1 = { dataset: { name: 'First Dataset' } };
      const metadata2 = { dataset: { name: 'Second Dataset' } };
      
      cacheService.setCachedMetadata(metadata1);
      cacheService.setCachedMetadata(metadata2);
      
      const result = cacheService.getCachedMetadata();
      expect(result).toEqual(metadata2);
    });
  });

  describe('isCacheStale', () => {
    test('should return false when no cache exists', () => {
      const result = cacheService.isCacheStale();
      expect(result).toBe(false);
    });

    test('should return false when cache is fresh', () => {
      const metadata = { dataset: { name: 'Test Dataset' } };
      cacheService.setCachedMetadata(metadata);
      
      const result = cacheService.isCacheStale();
      expect(result).toBe(false);
    });

    test('should return true when cache is stale', () => {
      const metadata = { dataset: { name: 'Test Dataset' } };
      
      // Manually set stale cache
      const storage = cacheService._getCacheStorage();
      storage.metadata.data = metadata;
      storage.metadata.lastFetched = Date.now() - (6 * 60 * 1000); // 6 minutes ago (stale)
      
      const result = cacheService.isCacheStale();
      expect(result).toBe(true);
    });
  });

  describe('getCacheInfo', () => {
    test('should return no_cache status when no cache exists', () => {
      const result = cacheService.getCacheInfo();
      
      expect(result).toEqual({
        status: 'no_cache',
        message: 'No metadata cached yet',
        cacheInfo: { 
          lastFetched: null, 
          cacheAge: null 
        }
      });
    });

    test('should return cached status with cache information when cache exists', () => {
      const metadata = { dataset: { name: 'Test Dataset' } };
      cacheService.setCachedMetadata(metadata);
      
      const result = cacheService.getCacheInfo();
      
      expect(result.status).toBe('cached');
      expect(result.cacheInfo).toBeDefined();
      expect(result.cacheInfo.lastFetched).toBeDefined();
      expect(result.cacheInfo.cacheAgeMs).toBeGreaterThanOrEqual(0);
      expect(result.cacheInfo.isStale).toBe(false);
      expect(result.cacheInfo.cacheDurationMs).toBe(5 * 60 * 1000); // 5 minutes
    });

    test('should indicate stale cache in cache info', () => {
      const metadata = { dataset: { name: 'Test Dataset' } };
      
      // Manually set stale cache
      const storage = cacheService._getCacheStorage();
      storage.metadata.data = metadata;
      storage.metadata.lastFetched = Date.now() - (6 * 60 * 1000); // 6 minutes ago (stale)
      
      const result = cacheService.getCacheInfo();
      
      expect(result.status).toBe('cached');
      expect(result.cacheInfo.isStale).toBe(true);
      expect(result.cacheInfo.cacheAgeMs).toBeGreaterThan(5 * 60 * 1000);
    });
  });

  describe('clearCache', () => {
    test('should clear all cached data', () => {
      const metadata = { dataset: { name: 'Test Dataset' } };
      cacheService.setCachedMetadata(metadata);
      
      // Verify cache exists
      expect(cacheService.getCachedMetadata()).toEqual(metadata);
      
      // Clear cache
      cacheService.clearCache();
      
      // Verify cache is cleared
      expect(cacheService.getCachedMetadata()).toBeNull();
      
      const cacheInfo = cacheService.getCacheInfo();
      expect(cacheInfo.status).toBe('no_cache');
    });
  });

  describe('cache behavior over time', () => {
    test('should handle cache expiration correctly', async () => {
      const metadata = { dataset: { name: 'Test Dataset' } };
      cacheService.setCachedMetadata(metadata);
      
      // Cache should be fresh immediately
      expect(cacheService.getCachedMetadata()).toEqual(metadata);
      expect(cacheService.isCacheStale()).toBe(false);
      
      // Manually age the cache to simulate time passing
      const storage = cacheService._getCacheStorage();
      storage.metadata.lastFetched = Date.now() - (6 * 60 * 1000); // 6 minutes ago
      
      // Cache should now be stale
      expect(cacheService.getCachedMetadata()).toBeNull();
      expect(cacheService.isCacheStale()).toBe(true);
    });
  });
});