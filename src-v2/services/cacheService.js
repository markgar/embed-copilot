/**
 * Cache Service - Shared caching logic to eliminate global state
 * 
 * Provides centralized caching functionality that can be used across
 * multiple endpoints and services, replacing module-level global variables.
 */

const { constants } = require('./configService');

/**
 * In-memory cache storage
 * This replaces the global variables that were previously in routes.js
 */
const cacheStorage = {
  metadata: {
    data: null,
    lastFetched: null
  }
  // Future cache entries can be added here (e.g., embedTokens, etc.)
};

/**
 * Get cached metadata if it exists and is not stale
 * @returns {Object|null} Cached metadata or null if not available/stale
 */
function getCachedMetadata() {
  const cached = cacheStorage.metadata;
  
  if (!cached.data || !cached.lastFetched) {
    return null;
  }

  const now = Date.now();
  const cacheAge = now - cached.lastFetched;
  
  if (cacheAge > constants.METADATA_CACHE_DURATION) {
    return null; // Cache is stale
  }

  return cached.data;
}

/**
 * Store metadata in cache with current timestamp
 * @param {Object} metadata - Metadata to cache
 */
function setCachedMetadata(metadata) {
  cacheStorage.metadata.data = metadata;
  cacheStorage.metadata.lastFetched = Date.now();
}

/**
 * Check if cached metadata exists but is stale
 * @returns {boolean} True if cache exists but is stale
 */
function isCacheStale() {
  const cached = cacheStorage.metadata;
  
  if (!cached.data || !cached.lastFetched) {
    return false; // No cache exists
  }

  const now = Date.now();
  const cacheAge = now - cached.lastFetched;
  
  return cacheAge > constants.METADATA_CACHE_DURATION;
}

/**
 * Get cache information for debugging/status endpoints
 * @returns {Object} Cache status information
 */
function getCacheInfo() {
  const cached = cacheStorage.metadata;
  
  if (!cached.data || !cached.lastFetched) {
    return {
      status: 'no_cache',
      message: 'No metadata cached yet',
      cacheInfo: { 
        lastFetched: cached.lastFetched, 
        cacheAge: null 
      }
    };
  }

  const now = Date.now();
  const cacheAge = now - cached.lastFetched;
  const isStale = cacheAge > constants.METADATA_CACHE_DURATION;

  return {
    status: 'cached',
    cacheInfo: { 
      lastFetched: new Date(cached.lastFetched).toISOString(), 
      cacheAgeMs: cacheAge, 
      isStale, 
      cacheDurationMs: constants.METADATA_CACHE_DURATION 
    }
  };
}

/**
 * Clear all cached data (useful for testing or manual cache invalidation)
 */
function clearCache() {
  cacheStorage.metadata.data = null;
  cacheStorage.metadata.lastFetched = null;
}

/**
 * Get raw cache storage for testing purposes
 * @returns {Object} Internal cache storage object
 */
function _getCacheStorage() {
  return cacheStorage;
}

module.exports = {
  getCachedMetadata,
  setCachedMetadata,
  isCacheStale,
  getCacheInfo,
  clearCache,
  _getCacheStorage // For testing only
};