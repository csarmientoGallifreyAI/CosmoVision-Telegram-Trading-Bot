/**
 * AI Services Initialization
 *
 * This file initializes all AI services and providers used in the application.
 * It sets up OpenAI, Hugging Face, and local model services, as well as
 * the AIProviderManager that manages provider selection and fallbacks.
 */

const OpenAIService = require('../services/openai');
const HuggingFaceService = require('../services/huggingface');
const LocalModelsService = require('../services/localModels');
const AIProviderManager = require('../services/aiProvider');
const CacheService = require('../services/cache');
const RateLimiter = require('../services/rateLimiter');
const TradingService = require('../services/trading');
const Logger = require('../services/logger');

// Import AI components
const NLPEngine = require('./nlpEngine');
const RiskAnalyzer = require('./riskAnalyzer');
const TrendAnalyzer = require('./trendAnalyzer');

/**
 * Initialize all AI services
 * @returns {boolean} Whether initialization was successful
 */
async function initializeAIServices() {
  try {
    Logger.info('Initializing AI services...');

    // Initialize cache service first with specific configurations
    const cacheConfig = {
      maxCacheSize: 10000, // Maximum number of items to keep in memory cache
      enableDiskCache: true, // Enable disk caching for persistence
      diskCachePath: 'cache/embeddings', // Path to store cache files
      diskCacheMaxFiles: 1000, // Maximum number of files in disk cache
      diskCacheMaxSizeMB: 100, // Maximum size of disk cache in MB
    };

    try {
      Logger.info('Initializing cache service...');
      await CacheService.initialize(cacheConfig);
      Logger.info('Cache service initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize cache service:', { error: error.message });
      // Continue even if cache initialization fails
    }

    // Initialize OpenAI service
    try {
      Logger.info('Initializing OpenAI service...');
      await OpenAIService.initialize();
      Logger.info('OpenAI service initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize OpenAI service:', { error: error.message });
      // Continue even if OpenAI initialization fails
    }

    // Initialize Hugging Face service
    try {
      Logger.info('Initializing Hugging Face service...');
      await HuggingFaceService.initialize();
      Logger.info('Hugging Face service initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize Hugging Face service:', { error: error.message });
      // Continue even if Hugging Face initialization fails
    }

    // Initialize Trading service
    try {
      Logger.info('Initializing Trading service...');
      TradingService.initialize();
      Logger.info('Trading service initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize Trading service:', { error: error.message });
      // Continue even if Trading service initialization fails
    }

    // Initialize local models service if available
    let localModelsAvailable = false;
    try {
      Logger.info('Checking for local AI models...');
      const localModelsService = new LocalModelsService();
      localModelsAvailable = await localModelsService.initialize();

      if (localModelsAvailable) {
        Logger.info('Local AI models initialized successfully');
      } else {
        Logger.info('No local AI models available or initialized');
      }
    } catch (error) {
      Logger.error('Error when initializing local models:', { error: error.message });
      // Continue even if local models initialization fails
    }

    // Initialize rate limiter
    try {
      Logger.info('Initializing rate limiter...');
      RateLimiter.initialize();
      Logger.info('Rate limiter initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize rate limiter:', { error: error.message });
      // Continue even if rate limiter initialization fails
    }

    // Initialize AI provider manager LAST, since it depends on other services
    try {
      Logger.info('Initializing AI provider manager...');
      await AIProviderManager.initialize({
        useLocalModels: localModelsAvailable,
      });
      Logger.info('AI provider manager initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize AI provider manager:', { error: error.message });
      return false;
    }

    Logger.info('All AI services initialized successfully');
    return true;
  } catch (error) {
    Logger.error('Unexpected error during AI services initialization:', { error: error.message });
    return false;
  }
}

module.exports = {
  initializeAIServices,
  NLPEngine,
  RiskAnalyzer,
  TrendAnalyzer,
};
