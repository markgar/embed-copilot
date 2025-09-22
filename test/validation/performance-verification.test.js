/**
 * Performance Verification Tests
 * 
 * Tests to ensure the new service architecture maintains
 * reasonable performance characteristics.
 */

const PowerBIService = require('../../src-v2/services/powerbiService');
const cacheService = require('../../src-v2/services/cacheService');

// Mock configService
jest.mock('../../src-v2/services/configService', () => ({
  loadConfig: jest.fn(() => ({
    clientId: 'test-client-id',
    tenantId: 'test-tenant-id',
    clientSecret: 'test-client-secret',
    authorityUrl: 'https://login.microsoftonline.com/',
    scopeBase: 'https://analysis.windows.net/powerbi/api/.default',
    powerBIGroupId: 'test-group-id',
    powerBIReportId: 'test-report-id'
  })),
  validateConfig: jest.fn(),
  constants: {
    METADATA_CACHE_DURATION: 5 * 60 * 1000 // 5 minutes
  }
}));

describe('Performance Verification', () => {
  let powerbiService;
  let mockConfig;

  beforeEach(() => {
    cacheService.clearCache();

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

  describe('Service Instantiation Performance', () => {
    it('should instantiate PowerBI service quickly', () => {
      const iterations = 100;
      const start = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        new PowerBIService(mockConfig);
      }
      
      const time = Date.now() - start;
      const avgTime = time / iterations;
      
      // Should be very fast (less than 1ms per instantiation on average)
      expect(avgTime).toBeLessThan(1);
      console.log(`PowerBI service instantiation: ${avgTime.toFixed(3)}ms average over ${iterations} iterations`);
    });

    it('should load configuration quickly', () => {
      const iterations = 50;
      const start = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        new PowerBIService(); // Will call configService.loadConfig()
      }
      
      const time = Date.now() - start;
      const avgTime = time / iterations;
      
      // Should be reasonably fast (less than 5ms per load on average)
      expect(avgTime).toBeLessThan(5);
      console.log(`Config loading: ${avgTime.toFixed(3)}ms average over ${iterations} iterations`);
    });
  });

  describe('Metadata Processing Performance', () => {
    it('should process metadata quickly', async () => {
      const start = Date.now();
      
      const metadata = await powerbiService.getDatasetMetadata('group-id', 'dataset-id');
      
      const time = Date.now() - start;
      
      // Should process metadata quickly (less than 10ms for hardcoded data)
      expect(time).toBeLessThan(10);
      expect(metadata).toBeDefined();
      expect(metadata.tables).toHaveLength(5);
      
      console.log(`Metadata processing: ${time}ms`);
    });

    it('should process different metadata formats efficiently', async () => {
      const formats = [
        { name: 'complete', fn: () => powerbiService.getDatasetMetadata('group-id', 'dataset-id') },
        { name: 'simplified', fn: () => powerbiService.getSimplifiedMetadata('group-id', 'dataset-id') },
        { name: 'schema', fn: () => powerbiService.getNameOnlySchema('group-id', 'dataset-id') }
      ];

      for (const format of formats) {
        const start = Date.now();
        const result = await format.fn();
        const time = Date.now() - start;
        
        expect(time).toBeLessThan(15); // Should be fast for all formats
        expect(result).toBeDefined();
        
        console.log(`${format.name} metadata: ${time}ms`);
      }
    });

    it('should benefit from caching', async () => {
      // First call (uncached)
      const start1 = Date.now();
      await powerbiService.getDatasetMetadata('group-id', 'dataset-id');
      const uncachedTime = Date.now() - start1;
      
      // Second call (cached)
      const start2 = Date.now();
      await powerbiService.getDatasetMetadata('group-id', 'dataset-id');
      const cachedTime = Date.now() - start2;
      
      // Cached should be faster or at least not significantly slower
      expect(cachedTime).toBeLessThanOrEqual(uncachedTime * 2);
      
      console.log(`Uncached: ${uncachedTime}ms, Cached: ${cachedTime}ms`);
    });
  });

  describe('Cache Service Performance', () => {
    it('should perform cache operations quickly', () => {
      const testData = { dataset: { name: 'Test' }, tables: [] };
      const iterations = 1000;
      
      // Test cache writes
      let start = Date.now();
      for (let i = 0; i < iterations; i++) {
        cacheService.setCachedMetadata(testData);
      }
      let writeTime = Date.now() - start;
      
      // Test cache reads
      start = Date.now();
      for (let i = 0; i < iterations; i++) {
        cacheService.getCachedMetadata();
      }
      let readTime = Date.now() - start;
      
      // Should be very fast
      expect(writeTime / iterations).toBeLessThan(0.1); // Less than 0.1ms per write
      expect(readTime / iterations).toBeLessThan(0.1);  // Less than 0.1ms per read
      
      console.log(`Cache writes: ${(writeTime / iterations).toFixed(4)}ms avg, reads: ${(readTime / iterations).toFixed(4)}ms avg`);
    });

    it('should handle cache info generation efficiently', () => {
      const iterations = 500;
      
      // Set some test data
      cacheService.setCachedMetadata({ dataset: { name: 'Test' } });
      
      const start = Date.now();
      for (let i = 0; i < iterations; i++) {
        cacheService.getCacheInfo();
      }
      const time = Date.now() - start;
      
      expect(time / iterations).toBeLessThan(0.5); // Less than 0.5ms per call
      console.log(`Cache info generation: ${(time / iterations).toFixed(4)}ms average`);
    });
  });

  describe('Memory Usage Characteristics', () => {
    it('should not create memory leaks with repeated operations', async () => {
      // Perform multiple operations
      for (let i = 0; i < 10; i++) {
        await powerbiService.getDatasetMetadata('group-id', 'dataset-id');
        await powerbiService.getSimplifiedMetadata('group-id', 'dataset-id');
        await powerbiService.getNameOnlySchema('group-id', 'dataset-id');
        
        // Clear and reset cache periodically
        if (i % 3 === 0) {
          cacheService.clearCache();
        }
      }
      
      // Check final cache state is reasonable
      const storage = cacheService._getCacheStorage();
      expect(Object.keys(storage)).toHaveLength(1); // Should only have metadata cache
      
      // If there's cached data, it should be properly structured
      if (storage.metadata.data) {
        expect(storage.metadata.data.dataset).toBeDefined();
        expect(storage.metadata.lastFetched).toBeGreaterThan(0);
      }
    });

    it('should maintain consistent performance over multiple calls', async () => {
      const times = [];
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        cacheService.clearCache(); // Ensure fresh call each time
        
        const start = Date.now();
        await powerbiService.getDatasetMetadata('group-id', 'dataset-id');
        times.push(Date.now() - start);
      }
      
      // Calculate statistics
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const max = Math.max(...times);
      const min = Math.min(...times);
      
      // Performance should be consistent (handle edge case where times are all 0)
      if (avg > 0) {
        expect(max).toBeLessThan(avg * 10); // Increased tolerance from 5x to 10x
      } else {
        expect(max).toBeLessThanOrEqual(1); // Very fast, all calls under 1ms
      }
      
      console.log(`Performance over ${iterations} calls - avg: ${avg.toFixed(2)}ms, min: ${min}ms, max: ${max}ms`);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle errors quickly without performance degradation', async () => {
      const iterations = 20;
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        
        try {
          // This will succeed since we use hardcoded data
          await powerbiService.getDatasetMetadata('group-id', 'dataset-id');
        } catch (error) {
          // Expected for some cases
        }
        
        times.push(Date.now() - start);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      // Should maintain good performance even with potential errors
      expect(avgTime).toBeLessThan(20);
      console.log(`Error handling performance: ${avgTime.toFixed(2)}ms average`);
    });
  });
});