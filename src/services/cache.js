/**
 * Caching service for API optimization
 * Provides memory caching with expiration to reduce external API calls
 */
const Logger = require('./logger');

class CacheService {
  static cache = new Map();
  static maxCacheSize = 100; // Adjust based on memory constraints

  static get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check expiry
    if (item.expiry && item.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  static set(key, value, ttlSeconds = 3600) {
    // Check if cache is getting too large
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entries (first 10%)
      const keysToDelete = Array.from(this.cache.keys()).slice(
        0,
        Math.ceil(this.maxCacheSize * 0.1)
      );
      Logger.debug(`Cache limit reached, removing ${keysToDelete.length} old entries`);
      keysToDelete.forEach((k) => this.cache.delete(k));
    }

    const expiry = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.cache.set(key, { value, expiry });
  }

  static async getOrFetch(key, fetchFn, ttlSeconds = 3600) {
    const cachedValue = this.get(key);
    if (cachedValue !== null) {
      Logger.debug(`Cache hit for key: ${key}`);
      return cachedValue;
    }

    Logger.debug(`Cache miss for key: ${key}, fetching data`);
    try {
      const value = await fetchFn();
      this.set(key, value, ttlSeconds);
      return value;
    } catch (error) {
      Logger.error(`Error in getOrFetch for key: ${key}`, { error: error.message });
      throw error;
    }
  }

  static invalidate(keyPattern) {
    if (keyPattern instanceof RegExp) {
      let count = 0;
      for (const key of this.cache.keys()) {
        if (keyPattern.test(key)) {
          this.cache.delete(key);
          count++;
        }
      }
      Logger.debug(`Invalidated ${count} cache entries matching pattern: ${keyPattern}`);
    } else {
      this.cache.delete(keyPattern);
      Logger.debug(`Invalidated cache entry with key: ${keyPattern}`);
    }
  }

  static clear() {
    const count = this.cache.size;
    this.cache.clear();
    Logger.debug(`Cleared entire cache (${count} entries)`);
  }

  static getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      maxSize: this.maxCacheSize,
    };
  }
}

module.exports = CacheService;
