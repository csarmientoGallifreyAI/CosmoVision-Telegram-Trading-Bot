/**
 * Service for rate limiting user requests to AI services
 * Uses in-memory storage with periodic cleanup
 */
const Logger = require('./logger');

class RateLimitService {
  /**
   * In-memory storage for rate limiting
   * Maps user IDs to their usage data
   * @type {Map<string, Object>}
   */
  static userLimits = new Map();

  /**
   * Default daily limit for API requests
   * @type {number}
   */
  static DEFAULT_DAILY_LIMIT = 20;

  /**
   * Limits by API type
   * @type {Object}
   */
  static LIMITS = {
    nlp: 20, // NLP intent detection
    embedding: 15, // Embedding generation
    trend: 10, // Trend analysis
    risk: 10, // Risk analysis
  };

  /**
   * Initialize the rate limiter
   * Sets up periodic cleanup of expired entries
   */
  static initialize() {
    // Clean up expired entries every hour
    setInterval(() => this.cleanupExpiredEntries(), 3600000);
    Logger.info('Rate limit service initialized');
  }

  /**
   * Check if a user has reached their rate limit for a specific API type
   * @param {string} userId - User identifier (e.g., Telegram user ID)
   * @param {string} apiType - Type of API being used (nlp, embedding, etc.)
   * @returns {boolean} - Whether the user can make the request
   */
  static canMakeRequest(userId, apiType = 'general') {
    // Skip rate limiting for special users
    if (this.isExemptUser(userId)) {
      return true;
    }

    const key = `${userId}:${apiType}`;
    const now = Date.now();
    const entry = this.userLimits.get(key) || this.createEntry(now);

    // Check if the day has changed since last request
    if (this.isDifferentDay(entry.timestamp, now)) {
      // Reset count for the new day
      entry.count = 0;
      entry.timestamp = now;
    }

    // Get the applicable limit
    const limit = this.LIMITS[apiType] || this.DEFAULT_DAILY_LIMIT;

    // Check if user has reached their limit
    const canProceed = entry.count < limit;

    if (!canProceed) {
      Logger.warn(`Rate limit reached for user ${userId} on ${apiType} API`);
    }

    return canProceed;
  }

  /**
   * Increment the request count for a user
   * @param {string} userId - User identifier
   * @param {string} apiType - Type of API being used
   * @returns {Object} - Updated usage data
   */
  static incrementRequestCount(userId, apiType = 'general') {
    // Skip counting for exempt users
    if (this.isExemptUser(userId)) {
      return { count: 0, unlimited: true };
    }

    const key = `${userId}:${apiType}`;
    const now = Date.now();
    let entry = this.userLimits.get(key);

    // Create new entry if none exists
    if (!entry) {
      entry = this.createEntry(now);
      this.userLimits.set(key, entry);
    }

    // Reset count if it's a new day
    if (this.isDifferentDay(entry.timestamp, now)) {
      entry.count = 0;
      entry.timestamp = now;
    }

    // Increment the count
    entry.count += 1;

    // Get the applicable limit
    const limit = this.LIMITS[apiType] || this.DEFAULT_DAILY_LIMIT;

    // Store the entry
    this.userLimits.set(key, entry);

    Logger.debug(`User ${userId} has used ${entry.count}/${limit} ${apiType} requests today`);
    return { count: entry.count, limit };
  }

  /**
   * Get usage statistics for a user
   * @param {string} userId - User identifier
   * @returns {Object} - User's usage statistics for all API types
   */
  static getUserStats(userId) {
    const stats = {};
    const now = Date.now();

    // Collect stats for each API type
    for (const [key, entry] of this.userLimits.entries()) {
      if (key.startsWith(`${userId}:`)) {
        const apiType = key.split(':')[1];

        // Reset count if it's a new day
        let count = entry.count;
        if (this.isDifferentDay(entry.timestamp, now)) {
          count = 0;
        }

        stats[apiType] = {
          count,
          limit: this.LIMITS[apiType] || this.DEFAULT_DAILY_LIMIT,
          remaining: Math.max(0, (this.LIMITS[apiType] || this.DEFAULT_DAILY_LIMIT) - count),
        };
      }
    }

    // Add missing API types with zero usage
    for (const apiType of Object.keys(this.LIMITS)) {
      if (!stats[apiType]) {
        stats[apiType] = {
          count: 0,
          limit: this.LIMITS[apiType],
          remaining: this.LIMITS[apiType],
        };
      }
    }

    return stats;
  }

  /**
   * Create a new rate limit entry
   * @param {number} timestamp - Current timestamp
   * @returns {Object} - New rate limit entry
   */
  static createEntry(timestamp) {
    return {
      count: 0,
      timestamp,
    };
  }

  /**
   * Check if two timestamps are from different days
   * @param {number} timestamp1 - First timestamp
   * @param {number} timestamp2 - Second timestamp
   * @returns {boolean} - Whether the timestamps are from different days
   */
  static isDifferentDay(timestamp1, timestamp2) {
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);

    return (
      date1.getFullYear() !== date2.getFullYear() ||
      date1.getMonth() !== date2.getMonth() ||
      date1.getDate() !== date2.getDate()
    );
  }

  /**
   * Remove expired entries from the map
   * An entry is considered expired if it's older than 7 days
   */
  static cleanupExpiredEntries() {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    let expiredCount = 0;
    for (const [key, entry] of this.userLimits.entries()) {
      if (entry.timestamp < sevenDaysAgo) {
        this.userLimits.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      Logger.debug(`Cleaned up ${expiredCount} expired rate limit entries`);
    }
  }

  /**
   * Check if a user is exempt from rate limits
   * @param {string} userId - User identifier
   * @returns {boolean} - Whether the user is exempt
   */
  static isExemptUser(userId) {
    // Admins are exempt from rate limits
    const adminChatId = process.env.ADMIN_CHAT_ID;
    return adminChatId && userId.toString() === adminChatId;
  }
}

module.exports = RateLimitService;
