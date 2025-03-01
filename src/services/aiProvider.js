/**
 * Service for managing different AI providers and intelligently switching between them
 * Handles fallbacks and provider selection based on availability and rate limits
 */
const Logger = require('./logger');
const OpenAIService = require('./openai');
const HuggingFaceService = require('./huggingface');
const RateLimitService = require('./rateLimit');
const CacheService = require('./cache');
const LocalModelsService = require('./localModels');

class AIProviderManager {
  /**
   * Available AI providers
   * @type {Object}
   */
  static PROVIDERS = {
    OPENAI: 'openai',
    HUGGINGFACE: 'huggingface',
    LOCAL: 'local',
    FALLBACK: 'fallback',
  };

  /**
   * Operation types that can be performed by AI providers
   * @type {Object}
   */
  static OPERATIONS = {
    EMBEDDING: 'embedding',
    NLP: 'nlp',
    CLASSIFICATION: 'classification',
    TREND: 'trend',
    RISK: 'risk',
    SIMILARITY: 'similarity',
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
    [this.PROVIDERS.LOCAL]: {
      available: false,
      errorCount: 0,
      lastError: null,
      lastErrorTime: 0,
    },
  };

  /**
   * Provider preference order by operation type
   * This determines which provider to try first for each operation
   * @type {Object}
   */
  static providerPreference = {
    [this.OPERATIONS.EMBEDDING]: [
      this.PROVIDERS.OPENAI,
      this.PROVIDERS.HUGGINGFACE,
      this.PROVIDERS.LOCAL,
      this.PROVIDERS.FALLBACK,
    ],
    [this.OPERATIONS.NLP]: [
      this.PROVIDERS.OPENAI,
      this.PROVIDERS.HUGGINGFACE,
      this.PROVIDERS.LOCAL,
      this.PROVIDERS.FALLBACK,
    ],
    [this.OPERATIONS.CLASSIFICATION]: [
      this.PROVIDERS.OPENAI,
      this.PROVIDERS.HUGGINGFACE,
      this.PROVIDERS.LOCAL,
      this.PROVIDERS.FALLBACK,
    ],
    [this.OPERATIONS.TREND]: [this.PROVIDERS.OPENAI, this.PROVIDERS.LOCAL, this.PROVIDERS.FALLBACK],
    [this.OPERATIONS.RISK]: [this.PROVIDERS.OPENAI, this.PROVIDERS.LOCAL, this.PROVIDERS.FALLBACK],
    [this.OPERATIONS.SIMILARITY]: [
      this.PROVIDERS.OPENAI,
      this.PROVIDERS.HUGGINGFACE,
      this.PROVIDERS.LOCAL,
      this.PROVIDERS.FALLBACK,
    ],
  };

  /**
   * Instance of LocalModelsService for non-API operations
   */
  static localModelsService = null;

  /**
   * Initialize the AI Provider Manager
   * @param {Object} options - Configuration options
   * @param {boolean} options.useLocalModels - Whether to use local models if available
   */
  static async initialize(options = {}) {
    // Default options
    const config = {
      useLocalModels: true,
      ...options,
    };

    // Reset provider status
    this.resetErrorCounts();

    // Initialize OpenAI provider status
    this.providerStatus[this.PROVIDERS.OPENAI].available = OpenAIService.isAvailable();

    // Initialize Hugging Face provider status
    this.providerStatus[this.PROVIDERS.HUGGINGFACE].available = HuggingFaceService.isAvailable();

    // Initialize Local Models provider status
    if (config.useLocalModels) {
      // Create a local models service instance if we're configured to use it
      try {
        this.localModelsService = new LocalModelsService();
        const isInitialized = await this.localModelsService.initialize();
        this.providerStatus[this.PROVIDERS.LOCAL].available = isInitialized;

        if (isInitialized) {
          Logger.info('Local models service initialized successfully');
        } else {
          Logger.warn('Local models service initialized but no models are available');
          this.providerStatus[this.PROVIDERS.LOCAL].available = false;
        }
      } catch (error) {
        this.providerStatus[this.PROVIDERS.LOCAL].available = false;
        Logger.warn('Local models not available:', { error: error.message });
      }
    } else {
      this.providerStatus[this.PROVIDERS.LOCAL].available = false;
      Logger.info('Local models disabled by configuration');
    }

    Logger.info('AI Provider Manager initialized', {
      openaiAvailable: this.providerStatus[this.PROVIDERS.OPENAI].available,
      huggingfaceAvailable: this.providerStatus[this.PROVIDERS.HUGGINGFACE].available,
      localAvailable: this.providerStatus[this.PROVIDERS.LOCAL].available,
    });

    // Reset provider status every hour
    setInterval(() => this.resetErrorCounts(), 3600000);
    return true;
  }

  /**
   * Select the best provider for a given operation based on preference order
   * @param {string} operation - The operation type (e.g., 'embedding', 'nlp')
   * @param {string} userId - The user ID making the request
   * @returns {string} - The selected provider
   */
  static selectProvider(operation, userId) {
    // Map operation to a standardized operation type
    const opType = Object.values(this.OPERATIONS).includes(operation)
      ? operation
      : this.OPERATIONS.NLP;

    // Check user rate limits first
    if (!RateLimitService.canMakeRequest(userId, opType)) {
      Logger.warn(`Rate limit reached for user ${userId} on ${opType}`);
      return this.PROVIDERS.FALLBACK;
    }

    // Use the preference order for this operation type
    const preferenceOrder =
      this.providerPreference[opType] || this.providerPreference[this.OPERATIONS.NLP];

    // Try each provider in order of preference until we find an available one
    for (const provider of preferenceOrder) {
      // Skip FALLBACK as it's handled specially
      if (provider === this.PROVIDERS.FALLBACK) continue;

      const status = this.providerStatus[provider];

      // Check if this provider is available and not experiencing too many errors
      if (status && status.available && status.errorCount < 3) {
        // Track the request for rate limiting
        RateLimitService.incrementRequestCount(userId, opType);
        return provider;
      }
    }

    // All providers are unavailable or over error threshold, use fallback
    Logger.warn(`All AI providers unavailable for ${opType}, using fallback`);
    return this.PROVIDERS.FALLBACK;
  }

  /**
   * Check if we should use a specific provider for an operation
   * Useful to override the automatic provider selection
   * @param {string} provider - The provider to check
   * @param {string} operation - The operation type
   * @param {string} userId - The user ID making the request
   * @returns {boolean} - Whether to use this provider
   */
  static shouldUseProvider(provider, operation, userId) {
    // If the provider isn't in our list, return false
    if (!this.providerStatus[provider]) return false;

    // Check if user has reached rate limits
    if (!RateLimitService.canMakeRequest(userId, operation)) {
      return false;
    }

    // Check provider status
    const status = this.providerStatus[provider];
    return status.available && status.errorCount < 3;
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
   * Generate embeddings for a given text
   * @param {string} text - Text to create embeddings for
   * @param {string} userId - User ID for rate limiting
   * @returns {Promise<Array<number>>} - Embedding vector
   */
  static async generateEmbedding(text, userId = 'system') {
    const provider = this.selectProvider(this.OPERATIONS.EMBEDDING, userId);
    let embedding = null;

    // Try to get from cache first
    const cacheKey = `embedding:${text}`;
    embedding = CacheService.get(cacheKey);

    if (embedding) {
      return embedding;
    }

    try {
      // Use the selected provider
      switch (provider) {
        case this.PROVIDERS.OPENAI:
          embedding = await OpenAIService.generateEmbedding(text);
          break;
        case this.PROVIDERS.HUGGINGFACE:
          embedding = await HuggingFaceService.generateEmbedding(text);
          break;
        case this.PROVIDERS.LOCAL:
          if (this.localModelsService && this.localModelsService.isAvailable) {
            embedding = await this.localModelsService.generateEmbedding(text);
          } else {
            throw new Error('Local models service not available');
          }
          break;
        case this.PROVIDERS.FALLBACK:
          // Use a simple fallback method that doesn't require API
          embedding = this.generateFallbackEmbedding(text);
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }

      if (embedding) {
        // Cache the result
        CacheService.set(cacheKey, embedding, 86400); // 24 hours cache

        // Reset error count on success
        this.resetErrorCount(provider);

        return embedding;
      } else {
        throw new Error(`Provider ${provider} returned null embedding`);
      }
    } catch (error) {
      // Handle provider error and retry with next provider
      this.handleProviderError(provider, error);

      // If we haven't tried all providers yet, try with next best provider
      const preferenceOrder = this.providerPreference[this.OPERATIONS.EMBEDDING];
      const nextProviderIndex = preferenceOrder.indexOf(provider) + 1;

      if (nextProviderIndex < preferenceOrder.length) {
        const nextProvider = preferenceOrder[nextProviderIndex];
        // Override provider selection and retry
        Logger.info(`Retrying embedding with next provider: ${nextProvider}`);
        this.providerStatus[provider].available = false; // Temporarily disable
        return this.generateEmbedding(text, userId);
      }

      // If we've tried all providers, return fallback
      Logger.error('All embedding providers failed, using fallback');
      return this.generateFallbackEmbedding(text);
    }
  }

  /**
   * Process a query using NLP
   * @param {string} query - The query to process
   * @param {string} userId - User ID for rate limiting
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Processed query result
   */
  static async processQuery(query, userId = 'system', options = {}) {
    const provider = this.selectProvider(this.OPERATIONS.NLP, userId);

    try {
      // Use the selected provider
      switch (provider) {
        case this.PROVIDERS.OPENAI:
          return await OpenAIService.processQuery(query, options);
        case this.PROVIDERS.HUGGINGFACE:
          return await HuggingFaceService.processQuery(query, options);
        case this.PROVIDERS.LOCAL:
          if (this.localModelsService && this.localModelsService.isAvailable) {
            // For now, just do intent classification with local models
            const intent = await this.localModelsService.classifyIntent(query);
            return {
              intent: intent.intent,
              confidence: intent.confidence,
              entities: [],
              processed_query: query,
            };
          } else {
            throw new Error('Local models service not available');
          }
        case this.PROVIDERS.FALLBACK:
          // Simple fallback that doesn't rely on external APIs
          return this.processFallbackQuery(query);
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
    } catch (error) {
      // Handle provider error and retry with next provider
      this.handleProviderError(provider, error);

      // If we haven't tried all providers yet, try with next best provider
      const preferenceOrder = this.providerPreference[this.OPERATIONS.NLP];
      const nextProviderIndex = preferenceOrder.indexOf(provider) + 1;

      if (nextProviderIndex < preferenceOrder.length) {
        const nextProvider = preferenceOrder[nextProviderIndex];
        // Override provider selection and retry
        Logger.info(`Retrying query with next provider: ${nextProvider}`);
        return this.processQuery(query, userId, options);
      }

      // If we've tried all providers, return fallback
      Logger.error('All NLP providers failed, using fallback');
      return this.processFallbackQuery(query);
    }
  }

  /**
   * Get the status of all providers
   * @returns {Object} - Status information for all providers
   */
  static getStatus() {
    return this.providerStatus;
  }

  /**
   * Check if a provider is operational for a specific operation
   * @param {string} provider - Provider to check
   * @param {string} operation - Operation to check provider for
   * @returns {boolean} - Whether the provider is operational
   */
  static isProviderOperational(provider, operation) {
    // Validate provider
    if (!this.providerStatus[provider]) {
      return false;
    }

    // Check if provider is in the preference list for this operation
    const opType = Object.values(this.OPERATIONS).includes(operation)
      ? operation
      : this.OPERATIONS.NLP;

    const preferenceOrder = this.providerPreference[opType] || [];
    if (!preferenceOrder.includes(provider)) {
      return false;
    }

    // Check provider status
    const status = this.providerStatus[provider];
    return status.available && status.errorCount < 3;
  }

  /**
   * Generate a fallback embedding when all providers fail
   * This creates a simple embedding based on token frequencies
   * @param {string} text - Text to create an embedding for
   * @returns {Array<number>} - A simple embedding vector
   */
  static generateFallbackEmbedding(text) {
    Logger.info('Using fallback embedding generation for: ' + text.substring(0, 50));

    // Create a simple 128-dimensional vector based on character frequencies
    const embedding = new Array(128).fill(0);

    // Normalize and clean the text
    const normalizedText = text.toLowerCase().trim();

    // Generate a simple embedding based on character frequencies and positions
    for (let i = 0; i < normalizedText.length; i++) {
      const char = normalizedText.charCodeAt(i);
      const position = i / normalizedText.length; // normalized position (0-1)

      // Use character code to distribute values across the embedding dimensions
      const dimension = char % embedding.length;

      // Add values based on character and position
      embedding[dimension] += (1 + position) / normalizedText.length;
    }

    // Normalize to unit length
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));

    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }

    return embedding;
  }

  /**
   * Process a query using a fallback method when all providers fail
   * @param {string} query - The query to process
   * @returns {Object} - Simple intent classification result
   */
  static processFallbackQuery(query) {
    Logger.info('Using fallback query processing for: ' + query.substring(0, 50));

    // Normalize the query
    const normalizedQuery = query.toLowerCase().trim();

    // Define keywords for simple intent detection
    const intentKeywords = {
      discovery: ['find', 'search', 'discover', 'list', 'show me', 'get', 'what', 'latest'],
      analysis: ['analyze', 'details', 'information', 'metrics', 'data', 'stats', 'how', 'why'],
      comparison: ['compare', 'versus', 'vs', 'difference', 'better', 'against', 'which'],
      transaction: ['buy', 'sell', 'trade', 'swap', 'convert', 'transaction', 'exchange'],
    };

    // Count keyword matches for each intent
    const scores = {};
    let maxScore = 0;
    let bestIntent = 'discovery'; // Default intent

    for (const [intent, keywords] of Object.entries(intentKeywords)) {
      scores[intent] = 0;

      for (const keyword of keywords) {
        if (normalizedQuery.includes(keyword)) {
          scores[intent] += 1;
        }
      }

      if (scores[intent] > maxScore) {
        maxScore = scores[intent];
        bestIntent = intent;
      }
    }

    // Extract potential entities using regex
    const symbols = normalizedQuery.match(/\b[A-Z]{2,5}\b/g) || [];
    const names = [];

    // Extract potential coin names (capitalized words)
    const words = normalizedQuery.split(/\s+/);
    for (const word of words) {
      if (word.length > 2 && word[0] === word[0].toUpperCase() && !symbols.includes(word)) {
        names.push(word);
      }
    }

    return {
      intent: bestIntent,
      confidence: Math.min(0.6, 0.3 + maxScore * 0.1), // Base confidence + bonus for keyword matches
      entities: {
        symbols: [...new Set(symbols)],
        names: [...new Set(names)],
      },
      processed_query: query,
    };
  }

  /**
   * Reset error count for a specific provider
   * @param {string} provider - Provider to reset
   */
  static resetErrorCount(provider) {
    if (this.providerStatus[provider]) {
      this.providerStatus[provider].errorCount = 0;
      this.providerStatus[provider].available = true;
    }
  }

  /**
   * Reset error counts for all providers
   */
  static resetErrorCounts() {
    for (const provider of Object.keys(this.providerStatus)) {
      this.resetErrorCount(provider);
    }
  }

  /**
   * Handle error from a provider
   * @param {string} provider - Provider that had an error
   * @param {Error} error - The error
   */
  static handleProviderError(provider, error) {
    if (!this.providerStatus[provider]) return;

    // Increment error count
    this.providerStatus[provider].errorCount += 1;

    // Mark as unavailable if too many errors
    if (this.providerStatus[provider].errorCount >= 3) {
      this.providerStatus[provider].available = false;
    }

    // Record error details
    this.providerStatus[provider].lastError = error.message;
    this.providerStatus[provider].lastErrorTime = Date.now();

    // Log the error
    Logger.error(`Error with ${provider} provider:`, {
      error: error.message,
      provider,
      errorCount: this.providerStatus[provider].errorCount,
    });
  }
}

module.exports = AIProviderManager;
