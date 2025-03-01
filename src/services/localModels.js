/**
 * LocalModelsService.js
 *
 * This service provides basic local AI capabilities without requiring
 * TensorFlow.js model loading, which can be challenging in some environments.
 * It implements simple but effective methods for embedding generation.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { cosineSimilarity } = require('../utils/vectorMath');
const Logger = require('./logger');

class LocalModelsService {
  constructor(config = {}) {
    this.config = {
      modelsDir: process.env.LOCAL_MODELS_DIR || path.join(process.cwd(), 'models'),
      embeddingModel: process.env.LOCAL_EMBEDDING_MODEL || 'simple-embeddings',
      embeddingDimension: 256, // Default dimension for embeddings
      ...config,
    };

    this.models = {};
    this.modelStatus = {
      embedding: true, // Simple embedding is always available
      classification: false,
    };

    this.errorCounts = {
      embedding: 0,
      classification: 0,
    };

    this.maxRetries = 3;
    this.isAvailable = true; // Simple embeddings are always available

    Logger.info('Initializing LocalModelsService with simple embeddings');
  }

  /**
   * Initialize the service
   */
  async initialize() {
    try {
      // Create models directory if it doesn't exist
      if (!fs.existsSync(this.config.modelsDir)) {
        Logger.info('Creating models directory:', this.config.modelsDir);
        fs.mkdirSync(this.config.modelsDir, { recursive: true });
      }

      Logger.info('LocalModelsService initialized with simple embedding capabilities');
      return true;
    } catch (error) {
      Logger.error('Error initializing LocalModelsService:', error.message);
      return false;
    }
  }

  /**
   * Generate embeddings for text using a deterministic algorithm
   * This doesn't require loading models, but still produces useful embeddings
   * @param {string} text - Text to encode
   * @returns {Promise<Array<number>>} - Embedding vector
   */
  async generateEmbedding(text) {
    try {
      Logger.debug('Generating embedding for text:', text.substring(0, 50) + '...');

      // Normalize text: lowercase, trim, and remove extra whitespace
      const normalizedText = text.toLowerCase().trim().replace(/\s+/g, ' ');

      // Generate a deterministic embedding based on text features
      const embedding = this.createDeterministicEmbedding(
        normalizedText,
        this.config.embeddingDimension
      );

      Logger.debug(`Generated embedding with ${embedding.length} dimensions`);
      return embedding;
    } catch (error) {
      Logger.error('Error generating embedding:', error.message);
      throw new Error(`Local embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Create a deterministic embedding for a text
   * Uses a combination of techniques to create semantic-like embeddings
   * @param {string} text - Text to embed
   * @param {number} dimension - Dimension of the embedding to generate
   * @returns {Array<number>} - Embedding vector
   */
  createDeterministicEmbedding(text, dimension = 256) {
    // Initialize embedding vector with zeros
    const embedding = new Array(dimension).fill(0);

    // Split text into tokens (words)
    const tokens = text.split(/\s+/);

    // Get character n-grams
    const ngrams = this.extractNgrams(text, 3); // trigrams

    // Process each token and n-gram to influence different dimensions of the embedding
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // Simple hashing to determine which dimension this token affects
      const hash = this.simpleHash(token);
      const dimIndex = hash % dimension;

      // Position-aware embedding (words at the beginning have more influence)
      const positionFactor = 1.0 / (1 + i * 0.5);

      // Length-aware weighting (longer words have more influence)
      const lengthFactor = Math.min(1.0, token.length / 10);

      // Combine factors for this token's influence
      const influence = positionFactor * lengthFactor;

      // Update the embedding dimension
      embedding[dimIndex] += influence;

      // Also update nearby dimensions to create smoother embeddings
      for (let j = 1; j <= 3; j++) {
        const nearbyDim1 = (dimIndex + j) % dimension;
        const nearbyDim2 = (dimIndex - j + dimension) % dimension;
        embedding[nearbyDim1] += influence * (0.5 / j);
        embedding[nearbyDim2] += influence * (0.5 / j);
      }
    }

    // Process n-grams to capture local context
    for (const ngram of ngrams) {
      const hash = this.simpleHash(ngram);
      const dimIndex = hash % dimension;
      embedding[dimIndex] += 0.5; // Less influence than full tokens
    }

    // Apply a final hash-based perturbation based on the full text
    // This ensures similar texts have similar overall patterns
    const fullTextHash = this.simpleHash(text);
    for (let i = 0; i < dimension; i++) {
      // Use the full text hash to generate deterministic noise
      const noise = ((fullTextHash * (i + 1)) % 100) / 1000;
      embedding[i] += noise;
    }

    // Normalize to unit length for proper similarity comparison
    return this.normalizeVector(embedding);
  }

  /**
   * Normalize a vector to unit length
   * @param {Array<number>} vector - Vector to normalize
   * @returns {Array<number>} - Normalized vector
   */
  normalizeVector(vector) {
    // Calculate magnitude (L2 norm)
    let sumSquares = 0;
    for (const value of vector) {
      sumSquares += value * value;
    }
    const magnitude = Math.sqrt(sumSquares);

    // Avoid division by zero
    if (magnitude === 0) {
      return vector;
    }

    // Normalize
    return vector.map((value) => value / magnitude);
  }

  /**
   * Extract n-grams from text
   * @param {string} text - Input text
   * @param {number} n - Size of n-grams
   * @returns {Array<string>} - List of n-grams
   */
  extractNgrams(text, n) {
    const ngrams = [];
    for (let i = 0; i <= text.length - n; i++) {
      ngrams.push(text.substring(i, i + n));
    }
    return ngrams;
  }

  /**
   * Simple but deterministic hash function
   * @param {string} text - Text to hash
   * @returns {number} - Hash value
   */
  simpleHash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Simple intent classification based on keyword matching
   * @param {string} text - Text to classify
   * @returns {Promise<Object>} - Classification result
   */
  async classifyIntent(text) {
    try {
      const normalizedText = text.toLowerCase().trim();

      // Define intents and their associated keywords
      const intentKeywords = {
        discovery: ['find', 'search', 'discover', 'list', 'show me', 'what', 'which'],
        analysis: ['analyze', 'details', 'information', 'tell me about', 'what is', 'how'],
        comparison: ['compare', 'versus', 'vs', 'difference', 'better', 'worse'],
        transaction: ['buy', 'sell', 'trade', 'swap', 'convert', 'exchange'],
      };

      // Calculate scores for each intent
      const scores = {};
      let maxScore = 0;
      let bestIntent = 'discovery'; // Default intent

      for (const [intent, keywords] of Object.entries(intentKeywords)) {
        scores[intent] = 0;

        for (const keyword of keywords) {
          if (normalizedText.includes(keyword)) {
            scores[intent] += 1;
          }
        }

        // Adjust for keyword specificity
        if (intent === 'comparison' && scores[intent] > 0) {
          scores[intent] *= 1.2; // Boost comparison keywords as they're more specific
        }

        if (scores[intent] > maxScore) {
          maxScore = scores[intent];
          bestIntent = intent;
        }
      }

      // Calculate confidence based on the difference between top scores
      let confidence = 0.3 + maxScore * 0.1; // Base confidence

      // If there's a clear winner, increase confidence
      const scoreValues = Object.values(scores);
      const sortedScores = [...scoreValues].sort((a, b) => b - a);
      if (sortedScores.length > 1 && sortedScores[0] > sortedScores[1]) {
        confidence += 0.2; // Clear winner bonus
      }

      // Cap confidence at 0.95
      confidence = Math.min(0.95, confidence);

      return {
        intent: bestIntent,
        confidence,
        predictions: Object.entries(scores).map(([intent, score]) => ({
          intent,
          score: score / (maxScore || 1),
        })),
      };
    } catch (error) {
      Logger.error('Error classifying intent:', error.message);
      throw new Error(`Local intent classification failed: ${error.message}`);
    }
  }

  /**
   * Check the status of the service
   */
  checkStatus() {
    return {
      available: this.isAvailable,
      models: {
        embedding: this.modelStatus.embedding,
        classification: this.modelStatus.classification,
      },
      errors: {
        embedding: this.errorCounts.embedding,
        classification: this.errorCounts.classification,
      },
      modelTypes: {
        embedding: this.config.embeddingModel,
        classification: 'keyword-based',
      },
    };
  }
}

module.exports = LocalModelsService;
