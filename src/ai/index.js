/**
 * AI module exports
 * Provides a single point of access for all AI-related functionality
 */

const SimilarityEngine = require('./similarityEngine');
const TrendAnalyzer = require('./trendAnalyzer');
const NLPEngine = require('./nlpEngine');
const RiskAnalyzer = require('./riskAnalyzer');

module.exports = {
  SimilarityEngine,
  TrendAnalyzer,
  NLPEngine,
  RiskAnalyzer,
};
