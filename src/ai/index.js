/**
 * AI Module Index
 *
 * This file serves as a single point of access for all AI-related functionality.
 * It exports all the AI components used throughout the application.
 */

const SimilarityEngine = require('./similarityEngine');
const TrendAnalyzer = require('./trendAnalyzer');
const NLPEngine = require('./nlpEngine');
const RiskAnalyzer = require('./riskAnalyzer');
const Logger = require('../services/logger');
const RateLimitService = require('../services/rateLimit');
const AIProviderManager = require('../services/aiProvider');

// Initialize AI services if needed
try {
  // Only initialize in non-import contexts to avoid duplicate initialization
  if (require.main === module) {
    Logger.info('Initializing AI services from index.js');
    RateLimitService.initialize();
    AIProviderManager.initialize();
  }
} catch (error) {
  Logger.error('Error initializing AI services:', { error: error.message });
}

module.exports = {
  SimilarityEngine,
  TrendAnalyzer,
  NLPEngine,
  RiskAnalyzer,
};
