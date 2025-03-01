/**
 * Service for managing different AI providers and intelligently switching between them
 * Handles fallbacks and provider selection based on availability and rate limits
 */
const Logger = require('./logger');
const HuggingFaceService = require('./huggingface');
const RateLimitService = require('./rateLimit');
const CacheService = require('./cache');

class AIProviderManager {
  /**
   * Available AI providers
   * @type {Object}
   */
  static PROVIDERS = {
    OPENAI: 'openai',
    HUGGINGFACE: 'huggingface',
    FALLBACK: 'fallback',
  };

  /**
   * The current state of each provider
   * @type {Object}
   */
  static providerStatus = {
    [this.PROVIDERS.OPENAI]: {
      available: true,
      errorCount: 0,
      lastError: null,
      lastErrorTime: 0,
    },
    [this.PROVIDERS.HUGGINGFACE]: {
      available: true,
      errorCount: 0,
      lastError: null,
      lastErrorTime: 0,
    },
  };

  /**
   * Initialize the AI Provider Manager
   */
  static initialize() {
    // Check if Hugging Face is configured
    this.providerStatus[this.PROVIDERS.HUGGINGFACE].available = HuggingFaceService.isAvailable();

    Logger.info('AI Provider Manager initialized', {
      openaiAvailable: this.providerStatus[this.PROVIDERS.OPENAI].available,
      huggingfaceAvailable: this.providerStatus[this.PROVIDERS.HUGGINGFACE].available,
    });

    // Reset provider status every hour
    setInterval(() => this.resetErrorCounts(), 3600000);
  }

  /**
   * Select the best provider for a given operation
   * @param {string} operation - The operation type (e.g., 'embedding', 'intent')
   * @param {string} userId - The user ID making the request
   * @returns {string} - The selected provider
   */
  static selectProvider(operation, userId) {
    // Check user rate limits first
    if (!RateLimitService.canMakeRequest(userId, operation)) {
      Logger.warn(`Rate limit reached for user ${userId} on ${operation}`);
      return this.PROVIDERS.FALLBACK;
    }

    // If OpenAI is available and under error threshold, use it
    if (
      this.providerStatus[this.PROVIDERS.OPENAI].available &&
      this.providerStatus[this.PROVIDERS.OPENAI].errorCount < 3
    ) {
      // Track the request for rate limiting
      RateLimitService.incrementRequestCount(userId, operation);
      return this.PROVIDERS.OPENAI;
    }

    // Try Hugging Face as second option
    if (
      this.providerStatus[this.PROVIDERS.HUGGINGFACE].available &&
      this.providerStatus[this.PROVIDERS.HUGGINGFACE].errorCount < 3
    ) {
      // Track the request for rate limiting
      RateLimitService.incrementRequestCount(userId, operation);
      return this.PROVIDERS.HUGGINGFACE;
    }

    // Both providers are unavailable or over error threshold, use fallback
    Logger.warn(`All AI providers unavailable for ${operation}, using fallback`);
    return this.PROVIDERS.FALLBACK;
  }

  /**
   * Handle a provider error and update its status
   * @param {string} provider - The provider that experienced an error
   * @param {Error} error - The error that occurred
   */
  static handleProviderError(provider, error) {
    if (!this.providerStatus[provider]) return;

    const status = this.providerStatus[provider];
    status.errorCount += 1;
    status.lastError = error.message;
    status.lastErrorTime = Date.now();

    // If too many errors occur, mark the provider as unavailable
    if (status.errorCount >= 5) {
      status.available = false;
      Logger.error(`Marking ${provider} as unavailable due to multiple errors`, {
        provider,
        errorCount: status.errorCount,
        lastError: status.lastError,
      });
    }

    // Log the error
    Logger.error(`Error with ${provider} provider:`, {
      message: error.message,
      errorCount: status.errorCount,
    });
  }

  /**
   * Reset error counts for all providers
   * This is called periodically to give providers another chance
   */
  static resetErrorCounts() {
    for (const provider in this.providerStatus) {
      const status = this.providerStatus[provider];

      // Reset error count if it's been more than 30 minutes since the last error
      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;

      if (status.lastErrorTime < thirtyMinutesAgo) {
        if (status.errorCount > 0) {
          Logger.info(`Resetting error count for ${provider}`);
        }

        status.errorCount = 0;
        status.available = true;
      }
    }
  }

  /**
   * Generate an embedding vector using the best available provider
   * @param {string} text - Text to generate embedding for
   * @param {string} userId - User ID making the request
   * @param {Object} options - Additional options
   * @returns {Promise<Array<number>>} - The embedding vector
   */
  static async generateEmbedding(text, userId, options = {}) {
    // Generate cache key
    const cacheKey = `embedding_${text.substring(0, 100).replace(/\s+/g, '_')}`;

    try {
      // Try to get from cache first
      return await CacheService.getOrFetch(
        cacheKey,
        async () => {
          // Select the best provider
          const provider = this.selectProvider('embedding', userId);

          try {
            switch (provider) {
              case this.PROVIDERS.OPENAI:
                // This will be handled by SimilarityEngine.generateCoinEmbedding
                throw new Error('Delegate to SimilarityEngine');

              case this.PROVIDERS.HUGGINGFACE:
                return await HuggingFaceService.generateEmbedding(text, options);

              case this.PROVIDERS.FALLBACK:
              default:
                // This will be handled by SimilarityEngine.generateFallbackEmbedding
                throw new Error('Use fallback embedding');
            }
          } catch (error) {
            this.handleProviderError(provider, error);
            throw error;
          }
        },
        86400
      ); // Cache for 24 hours
    } catch (error) {
      Logger.error('Error generating embedding with all providers:', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process a natural language query using the best available provider
   * @param {string} query - The user's query
   * @param {string} userId - User ID making the request
   * @returns {Promise<Object>} - The processed query result
   */
  static async processQuery(query, userId) {
    // Generate cache key
    const normalizedQuery = query.toLowerCase().trim();
    const cacheKey = `query_${normalizedQuery.substring(0, 100).replace(/\s+/g, '_')}`;

    try {
      // Try to get from cache first
      return await CacheService.getOrFetch(
        cacheKey,
        async () => {
          // Select the best provider
          const provider = this.selectProvider('nlp', userId);

          try {
            switch (provider) {
              case this.PROVIDERS.OPENAI:
                // This will be handled by NLPEngine.detectIntent
                throw new Error('Delegate to NLPEngine');

              case this.PROVIDERS.HUGGINGFACE:
                return await HuggingFaceService.processQuery(query);

              case this.PROVIDERS.FALLBACK:
              default:
                // This will be handled by NLPEngine.fallbackIntentDetection
                throw new Error('Use fallback intent detection');
            }
          } catch (error) {
            this.handleProviderError(provider, error);
            throw error;
          }
        },
        86400
      ); // Cache for 24 hours
    } catch (error) {
      Logger.error('Error processing query with all providers:', {
        error: error.message,
        query: query.substring(0, 50),
      });
      throw error;
    }
  }

  /**
   * Get the status of all providers
   * @returns {Object} - Status information for all providers
   */
  static getStatus() {
    return this.providerStatus;
  }
}

module.exports = AIProviderManager;
