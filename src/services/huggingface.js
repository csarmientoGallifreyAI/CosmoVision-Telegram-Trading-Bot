/**
 * Service for interacting with Hugging Face models
 * Provides fallback functionality when OpenAI API is unavailable
 */
const fetch = require('node-fetch');
const Logger = require('./logger');

class HuggingFaceService {
  /**
   * API key for Hugging Face Inference API
   * @type {string}
   */
  static apiKey = process.env.HUGGINGFACE_API_KEY;

  /**
   * Check if the service is configured and available
   * @returns {boolean} - Whether the service is available
   */
  static isAvailable() {
    return !!this.apiKey;
  }

  /**
   * Generate embeddings using a Hugging Face model
   * @param {string} text - Text to embed
   * @param {object} options - Options for the request
   * @returns {Promise<Array<number>>} - The embedding vector
   */
  static async generateEmbedding(text, options = {}) {
    try {
      // Use sentence-transformers model which produces quality embeddings
      const model = options.model || 'sentence-transformers/all-MiniLM-L6-v2';

      // Make request to Hugging Face Inference API
      const response = await fetch(
        `https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: text,
            options: {
              wait_for_model: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Hugging Face API error: ${response.status} - ${JSON.stringify(error)}`);
      }

      // Parse embedding vector
      const embedding = await response.json();

      Logger.debug(`Generated Hugging Face embedding with ${embedding.length} dimensions`);
      return embedding;
    } catch (error) {
      Logger.error('Error generating Hugging Face embedding:', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Classify intent using a Hugging Face zero-shot classification model
   * @param {string} text - Text to classify
   * @param {Array<string>} labels - Possible intent labels
   * @returns {Promise<Object>} - Classification result with label and score
   */
  static async classifyIntent(text, labels = ['discovery', 'analysis', 'comparison', 'unknown']) {
    try {
      // Use BART model for zero-shot classification
      const model = 'facebook/bart-large-mnli';

      // Make request to Hugging Face Inference API
      const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text,
          parameters: {
            candidate_labels: labels,
          },
          options: {
            wait_for_model: true,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Hugging Face API error: ${response.status} - ${JSON.stringify(error)}`);
      }

      // Parse classification result
      const result = await response.json();

      // Format the result to match our expected structure
      const intentResult = {
        type: result.labels[0],
        confidence: result.scores[0],
      };

      Logger.debug('Hugging Face intent classification result:', intentResult);
      return intentResult;
    } catch (error) {
      Logger.error('Error classifying intent with Hugging Face:', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Extract entities from text using a Hugging Face model
   * This is a simplified version that uses regular expressions as a fallback
   * @param {string} text - Text to extract entities from
   * @param {string} intentType - The detected intent type
   * @returns {Object} - Extracted entities
   */
  static extractEntities(text, intentType) {
    // This is a simplified entity extraction using regex
    // For production, consider using a proper NER model from Hugging Face
    const result = {
      metrics: [],
    };

    // Extract blockchain names
    if (text.match(/\beth(ereum)?\b/i)) {
      result.chain = 'ETH';
    } else if (text.match(/\bbsc\b|\bbinance\b/i)) {
      result.chain = 'BSC';
    } else if (text.match(/\bnear\b/i)) {
      result.chain = 'NEAR';
    }

    // Extract metrics
    if (text.match(/\bprice\b|\bcost\b|\bworth\b/i)) {
      result.metrics.push('price');
    }
    if (text.match(/\bholder(s)?\b|\bcommunity\b/i)) {
      result.metrics.push('holders');
    }
    if (text.match(/\bmarket\s*cap\b/i)) {
      result.metrics.push('market_cap');
    }
    if (text.match(/\bvolume\b|\btrading\b|\btransfer(s)?\b/i)) {
      result.metrics.push('transfers_24h');
    }

    // Extract price thresholds
    const priceMatch = text.match(/(\d+(?:\.\d+)?)\s*(usd|dollars|\$|eth|bnb)/i);
    if (priceMatch) {
      const amount = parseFloat(priceMatch[1]);
      if (!result.thresholds) result.thresholds = {};
      result.thresholds.price = {
        operator: '<',
        value: amount,
      };
    }

    // Extract coin names
    const coinMatch = text.match(/\b(about|analyze|similar\s+to)\s+([a-z0-9]+)/i);
    if (coinMatch) {
      result.coin_name = coinMatch[2];
    }

    return result;
  }

  /**
   * Process a natural language query completely using Hugging Face
   * This serves as a complete fallback for NLPEngine
   * @param {string} query - User's natural language query
   * @returns {Promise<Object>} - Processed query with intent and entities
   */
  static async processQuery(query) {
    try {
      // First, classify the intent
      const intentResult = await this.classifyIntent(query);

      // Then extract entities
      const entities = this.extractEntities(query, intentResult.type);

      // Return combined result
      return {
        ...intentResult,
        ...entities,
        original_query: query,
      };
    } catch (error) {
      Logger.error('Error processing query with Hugging Face:', {
        error: error.message,
        query: query,
      });

      // If even Hugging Face fails, fall back to purely regex-based approach
      const type = query.match(/\bfind\b|\bdiscover\b|\bsearch\b|\bshow\b|\blist\b/i)
        ? 'discovery'
        : query.match(/\banalyze\b|\bdetails\b|\babout\b/i)
        ? 'analysis'
        : query.match(/\bcompare\b|\bversus\b|\bvs\b/i)
        ? 'comparison'
        : 'discovery';

      return {
        type,
        ...this.extractEntities(query, type),
        original_query: query,
        is_fallback: true,
      };
    }
  }
}

module.exports = HuggingFaceService;
