/**
 * Caching service for API optimization
 * Provides memory caching with expiration to reduce external API calls
 * Includes optional disk caching for persistence between restarts
 */
const Logger = require('./logger');
const fs = require('fs');
const path = require('path');

class CacheService {
  // In-memory cache
  static cache = new Map();
  static maxCacheSize = 500; // Increased for more caching capacity

  // Disk cache settings
  static diskCacheEnabled = false;
  static diskCachePath = path.join(process.cwd(), 'data', 'cache');
  static diskCacheMaxFiles = 1000;
  static diskCacheMaxSizeMB = 50; // Max 50MB disk cache

  /**
   * Initialize the cache service
   * @param {Object} options - Configuration options
   * @param {number} options.maxCacheSize - Maximum number of items in memory cache
   * @param {boolean} options.enableDiskCache - Whether to enable disk caching
   * @param {string} options.diskCachePath - Path to disk cache directory
   * @param {number} options.diskCacheMaxFiles - Maximum number of disk cache files
   * @param {number} options.diskCacheMaxSizeMB - Maximum size of disk cache in MB
   */
  static initialize(options = {}) {
    this.maxCacheSize = options.maxCacheSize || this.maxCacheSize;
    this.diskCacheEnabled = options.enableDiskCache || this.diskCacheEnabled;
    this.diskCachePath = options.diskCachePath || this.diskCachePath;
    this.diskCacheMaxFiles = options.diskCacheMaxFiles || this.diskCacheMaxFiles;
    this.diskCacheMaxSizeMB = options.diskCacheMaxSizeMB || this.diskCacheMaxSizeMB;

    if (this.diskCacheEnabled) {
      try {
        if (!fs.existsSync(this.diskCachePath)) {
          fs.mkdirSync(this.diskCachePath, { recursive: true });
        }
        Logger.info(`Disk cache enabled at ${this.diskCachePath}`);

        // Clean up old disk cache entries on startup
        this.cleanupDiskCache();
      } catch (error) {
        Logger.error('Error initializing disk cache:', { error: error.message });
        this.diskCacheEnabled = false;
      }
    }

    Logger.info('Cache service initialized', {
      memoryCache: { maxSize: this.maxCacheSize },
      diskCache: {
        enabled: this.diskCacheEnabled,
        path: this.diskCachePath,
        maxFiles: this.diskCacheMaxFiles,
        maxSizeMB: this.diskCacheMaxSizeMB,
      },
    });
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {*} - Cached value or null if not found/expired
   */
  static get(key) {
    // Try memory cache first
    const item = this.cache.get(key);
    if (item) {
      // Check expiry
      if (item.expiry && item.expiry < Date.now()) {
        this.cache.delete(key);
      } else {
        return item.value;
      }
    }

    // If not found in memory and disk cache is enabled, try disk
    if (this.diskCacheEnabled) {
      try {
        return this.getFromDisk(key);
      } catch (error) {
        Logger.debug(`Error reading from disk cache: ${error.message}`);
      }
    }

    return null;
  }

  /**
   * Set a value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttlSeconds - Time to live in seconds (0 = no expiry)
   * @param {boolean} persistToDisk - Whether to also save to disk (defaults to diskCacheEnabled)
   */
  static set(key, value, ttlSeconds = 3600, persistToDisk = this.diskCacheEnabled) {
    // Check if memory cache is getting too large
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

    // Set in memory cache
    this.cache.set(key, { value, expiry });

    // Set in disk cache if enabled and requested
    if (this.diskCacheEnabled && persistToDisk) {
      try {
        this.setToDisk(key, value, expiry);
      } catch (error) {
        Logger.debug(`Error writing to disk cache: ${error.message}`);
      }
    }
  }

  /**
   * Get value from cache or fetch it if not found/expired
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Function to fetch the value if not cached
   * @param {number} ttlSeconds - Time to live in seconds
   * @param {boolean} persistToDisk - Whether to save to disk
   * @returns {Promise<*>} - The value
   */
  static async getOrFetch(key, fetchFn, ttlSeconds = 3600, persistToDisk = this.diskCacheEnabled) {
    const cachedValue = this.get(key);
    if (cachedValue !== null) {
      Logger.debug(`Cache hit for key: ${key}`);
      return cachedValue;
    }

    Logger.debug(`Cache miss for key: ${key}, fetching data`);
    try {
      const value = await fetchFn();
      this.set(key, value, ttlSeconds, persistToDisk);
      return value;
    } catch (error) {
      Logger.error(`Error in getOrFetch for key: ${key}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Invalidate cache entries matching a key or pattern
   * @param {string|RegExp} keyPattern - Key or pattern to match
   * @param {boolean} includeDisk - Whether to also invalidate disk cache
   */
  static invalidate(keyPattern, includeDisk = true) {
    let count = 0;

    // Invalidate memory cache
    if (keyPattern instanceof RegExp) {
      for (const key of this.cache.keys()) {
        if (keyPattern.test(key)) {
          this.cache.delete(key);
          count++;
        }
      }
      Logger.debug(`Invalidated ${count} memory cache entries matching pattern: ${keyPattern}`);
    } else {
      if (this.cache.has(keyPattern)) {
        this.cache.delete(keyPattern);
        count = 1;
      }
      Logger.debug(`Invalidated memory cache entry with key: ${keyPattern}`);
    }

    // Invalidate disk cache if requested
    if (this.diskCacheEnabled && includeDisk) {
      try {
        const diskCount = this.invalidateFromDisk(keyPattern);
        Logger.debug(`Invalidated ${diskCount} disk cache entries`);
      } catch (error) {
        Logger.error('Error invalidating disk cache:', { error: error.message });
      }
    }

    return count;
  }

  /**
   * Clear all cache entries
   * @param {boolean} includeDisk - Whether to also clear disk cache
   */
  static clear(includeDisk = true) {
    const count = this.cache.size;
    this.cache.clear();
    Logger.debug(`Cleared memory cache (${count} entries)`);

    if (this.diskCacheEnabled && includeDisk) {
      try {
        this.clearDiskCache();
      } catch (error) {
        Logger.error('Error clearing disk cache:', { error: error.message });
      }
    }
  }

  /**
   * Get cache statistics
   * @param {boolean} includeDisk - Whether to include disk cache stats
   * @returns {Object} - Cache statistics
   */
  static getStats(includeDisk = true) {
    const stats = {
      memory: {
        size: this.cache.size,
        keyCount: this.cache.size,
        maxSize: this.maxCacheSize,
      },
    };

    if (this.diskCacheEnabled && includeDisk) {
      try {
        stats.disk = this.getDiskCacheStats();
      } catch (error) {
        Logger.error('Error getting disk cache stats:', { error: error.message });
        stats.disk = { error: error.message };
      }
    }

    return stats;
  }

  /**
   * Read a value from disk cache
   * @param {string} key - Cache key
   * @returns {*} - Cached value or null if not found/expired
   * @private
   */
  static getFromDisk(key) {
    const filePath = this.getDiskCachePath(key);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // Check expiry
      if (data.expiry && data.expiry < Date.now()) {
        // Delete expired file
        fs.unlinkSync(filePath);
        return null;
      }

      return data.value;
    } catch (error) {
      // If there's an error reading the file, consider it invalid
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkError) {
        // Ignore error deleting invalid file
      }
      return null;
    }
  }

  /**
   * Write a value to disk cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} expiry - Expiry timestamp
   * @private
   */
  static setToDisk(key, value, expiry) {
    // Check disk cache size before writing
    this.manageDiscCache();

    const filePath = this.getDiskCachePath(key);
    const data = { value, expiry };

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write to file
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
  }

  /**
   * Get the file path for a disk cache entry
   * @param {string} key - Cache key
   * @returns {string} - File path
   * @private
   */
  static getDiskCachePath(key) {
    // Create a file-safe version of the key
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Use a shard structure to avoid too many files in one directory
    const shard = safeKey.substring(0, 2).padStart(2, '_');

    return path.join(this.diskCachePath, shard, safeKey);
  }

  /**
   * Invalidate entries from disk cache
   * @param {string|RegExp} keyPattern - Key or pattern to match
   * @returns {number} - Number of entries invalidated
   * @private
   */
  static invalidateFromDisk(keyPattern) {
    let count = 0;

    // If it's a single key, just delete that file
    if (!(keyPattern instanceof RegExp)) {
      const filePath = this.getDiskCachePath(keyPattern);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        count = 1;
      }
      return count;
    }

    // For regex patterns, need to scan all cache files
    try {
      // Iterate through shard directories
      const shards = fs.readdirSync(this.diskCachePath);

      for (const shard of shards) {
        const shardPath = path.join(this.diskCachePath, shard);

        // Skip if not a directory
        if (!fs.statSync(shardPath).isDirectory()) continue;

        // Check each file in the shard
        const files = fs.readdirSync(shardPath);

        for (const file of files) {
          // If the file matches the pattern, delete it
          if (keyPattern.test(file)) {
            fs.unlinkSync(path.join(shardPath, file));
            count++;
          }
        }
      }
    } catch (error) {
      Logger.error('Error scanning disk cache:', { error: error.message });
    }

    return count;
  }

  /**
   * Clear all disk cache entries
   * @private
   */
  static clearDiskCache() {
    try {
      // Iterate through shard directories
      const shards = fs.readdirSync(this.diskCachePath);
      let count = 0;

      for (const shard of shards) {
        const shardPath = path.join(this.diskCachePath, shard);

        // Skip if not a directory
        if (!fs.statSync(shardPath).isDirectory()) continue;

        // Delete all files in the shard
        const files = fs.readdirSync(shardPath);

        for (const file of files) {
          fs.unlinkSync(path.join(shardPath, file));
          count++;
        }

        // Remove the empty shard directory
        fs.rmdirSync(shardPath);
      }

      Logger.debug(`Cleared disk cache (${count} entries)`);
      return count;
    } catch (error) {
      Logger.error('Error clearing disk cache:', { error: error.message });
      return 0;
    }
  }

  /**
   * Manage disk cache size and file count
   * @private
   */
  static manageDiscCache() {
    try {
      const stats = this.getDiskCacheStats();

      // If within limits, do nothing
      if (stats.fileCount < this.diskCacheMaxFiles && stats.sizeMB < this.diskCacheMaxSizeMB) {
        return;
      }

      // Need to clean up - get all cache files with their stats
      const files = this.getAllCacheFiles();

      // Sort by last modified time (oldest first)
      files.sort((a, b) => a.mtime - b.mtime);

      // Remove files until we're under the limits
      let removed = 0;
      let remainingFiles = files.length;
      let remainingSizeMB = stats.sizeMB;

      for (const file of files) {
        // Stop if we're under both limits
        if (
          remainingFiles <= this.diskCacheMaxFiles * 0.9 &&
          remainingSizeMB <= this.diskCacheMaxSizeMB * 0.9
        ) {
          break;
        }

        try {
          fs.unlinkSync(file.path);
          removed++;
          remainingFiles--;
          remainingSizeMB -= file.sizeMB;
        } catch (error) {
          // Ignore errors deleting individual files
        }
      }

      if (removed > 0) {
        Logger.debug(`Cleaned up disk cache: removed ${removed} files`);
      }
    } catch (error) {
      Logger.error('Error managing disk cache:', { error: error.message });
    }
  }

  /**
   * Get all cache files with their stats
   * @returns {Array<Object>} - List of files with stats
   * @private
   */
  static getAllCacheFiles() {
    const files = [];

    // Iterate through shard directories
    const shards = fs.readdirSync(this.diskCachePath);

    for (const shard of shards) {
      const shardPath = path.join(this.diskCachePath, shard);

      // Skip if not a directory
      if (!fs.statSync(shardPath).isDirectory()) continue;

      // Get all files in the shard
      const shardFiles = fs.readdirSync(shardPath);

      for (const file of shardFiles) {
        const filePath = path.join(shardPath, file);
        const stats = fs.statSync(filePath);

        files.push({
          path: filePath,
          size: stats.size,
          sizeMB: stats.size / (1024 * 1024),
          mtime: stats.mtime.getTime(),
        });
      }
    }

    return files;
  }

  /**
   * Get disk cache statistics
   * @returns {Object} - Disk cache statistics
   * @private
   */
  static getDiskCacheStats() {
    let fileCount = 0;
    let totalSize = 0;

    try {
      // Iterate through shard directories
      const shards = fs.readdirSync(this.diskCachePath);

      for (const shard of shards) {
        const shardPath = path.join(this.diskCachePath, shard);

        // Skip if not a directory
        if (!fs.statSync(shardPath).isDirectory()) continue;

        // Count files in the shard
        const files = fs.readdirSync(shardPath);
        fileCount += files.length;

        // Calculate total size
        for (const file of files) {
          const filePath = path.join(shardPath, file);
          const stats = fs.statSync(filePath);
          totalSize += stats.size;
        }
      }

      return {
        fileCount,
        size: totalSize,
        sizeMB: totalSize / (1024 * 1024),
        maxFiles: this.diskCacheMaxFiles,
        maxSizeMB: this.diskCacheMaxSizeMB,
      };
    } catch (error) {
      Logger.error('Error getting disk cache stats:', { error: error.message });
      return {
        fileCount: 0,
        size: 0,
        sizeMB: 0,
        error: error.message,
      };
    }
  }

  /**
   * Clean up expired entries from disk cache
   * @private
   */
  static cleanupDiskCache() {
    try {
      // Get all cache files
      const files = this.getAllCacheFiles();
      let removed = 0;

      // Check each file for expiry
      for (const file of files) {
        try {
          const data = JSON.parse(fs.readFileSync(file.path, 'utf8'));

          // Delete if expired
          if (data.expiry && data.expiry < Date.now()) {
            fs.unlinkSync(file.path);
            removed++;
          }
        } catch (error) {
          // If there's an error reading the file, consider it invalid
          try {
            fs.unlinkSync(file.path);
            removed++;
          } catch (unlinkError) {
            // Ignore error deleting invalid file
          }
        }
      }

      // Also manage overall size
      this.manageDiscCache();

      if (removed > 0) {
        Logger.debug(`Cleaned up disk cache: removed ${removed} expired files`);
      }
    } catch (error) {
      Logger.error('Error cleaning up disk cache:', { error: error.message });
    }
  }
}

module.exports = CacheService;
