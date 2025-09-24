/**
 * Cache Service - Shared caching logic to eliminate global state
 * 
 * @deprecated This service is being deprecated as part of simplifying the demo application.
 * Caching adds complexity that isn't necessary for a demo/prototype application.
 * 
 * DO NOT USE in new code. This service will be removed in future versions.
 * 
 * Previous functionality: Provided centralized caching functionality that could be used across
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
 * @deprecated This function is deprecated. Do not use in new code.
 * @returns {Object|null} Cached metadata or null if not available/stale
 */
function getCachedMetadata() {
  console.warn('[DEPRECATED] getCachedMetadata() is deprecated and will be removed. Do not use in new code.');
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
 * @deprecated This function is deprecated. Do not use in new code.
 * @param {Object} metadata - Metadata to cache
 */
function setCachedMetadata(metadata) {
  console.warn('[DEPRECATED] setCachedMetadata() is deprecated and will be removed. Do not use in new code.');
  cacheStorage.metadata.data = metadata;
  cacheStorage.metadata.lastFetched = Date.now();
}

/**
 * Check if cached metadata exists but is stale
 * @deprecated This function is deprecated. Do not use in new code.
 * @returns {boolean} True if cache exists but is stale
 */
function isCacheStale() {
  console.warn('[DEPRECATED] isCacheStale() is deprecated and will be removed. Do not use in new code.');
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
 * @deprecated This function is deprecated. Do not use in new code.
 * @returns {Object} Cache status information
 */
function getCacheInfo() {
  console.warn('[DEPRECATED] getCacheInfo() is deprecated and will be removed. Do not use in new code.');
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
 * @deprecated This function is deprecated. Do not use in new code.
 */
function clearCache() {
  console.warn('[DEPRECATED] clearCache() is deprecated and will be removed. Do not use in new code.');
  cacheStorage.metadata.data = null;
  cacheStorage.metadata.lastFetched = null;
}

/**
 * Get raw cache storage for testing purposes
 * @deprecated This function is deprecated. Do not use in new code.
 * @returns {Object} Internal cache storage object
 */
function _getCacheStorage() {
  console.warn('[DEPRECATED] _getCacheStorage() is deprecated and will be removed. Do not use in new code.');
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