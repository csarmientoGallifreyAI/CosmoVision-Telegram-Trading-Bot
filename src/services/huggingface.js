/**
 * Service for interacting with Hugging Face models
 * Provides fallback functionality when OpenAI API is unavailable
 */
const fetch = require('node-fetch');
const Logger = require('./logger');
const CacheService = require('./cache');

class HuggingFaceService {
  /**
   * API key for Hugging Face Inference API
   * @type {string}
   */
  static apiKey = process.env.HUGGINGFACE_API_KEY;

  /**
   * Cache for loaded models when running locally
   * @type {Object}
   */
  static localModels = {};

  /**
   * Keeps track of consecutive errors to help with backoff
   * @type {number}
   */
  static errorCount = 0;

  /**
   * Maximum number of retries for API calls
   * @type {number}
   */
  static MAX_RETRIES = 3;

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
    const cacheKey = `hf_embedding_${text.substring(0, 100).replace(/\s+/g, '_')}`;

    try {
      // Try to get from cache first
      return await CacheService.getOrFetch(
        cacheKey,
        async () => {
          // Use sentence-transformers model which produces quality embeddings
          const model = options.model || 'sentence-transformers/all-MiniLM-L6-v2';

          let retries = 0;
          while (retries <= this.MAX_RETRIES) {
            try {
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
                      use_cache: true,
                    },
                  }),
                  // Add timeout to prevent hanging
                  timeout: 10000,
                }
              );

              if (!response.ok) {
                // Check for specific error types to handle appropriately
                if (response.status === 429) {
                  // Rate limit hit
                  Logger.warn('Hugging Face rate limit hit, backing off');
                  await this.backoff(retries);
                  retries++;
                  continue;
                }

                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(
                  `Hugging Face API error: ${response.status} - ${JSON.stringify(error)}`
                );
              }

              // Parse embedding vector
              const embedding = await response.json();
              this.errorCount = 0; // Reset error count on success

              Logger.debug(`Generated Hugging Face embedding with ${embedding.length} dimensions`);
              return embedding;
            } catch (error) {
              if (retries < this.MAX_RETRIES) {
                Logger.warn(`Hugging Face API error (retry ${retries + 1}/${this.MAX_RETRIES}):`, {
                  error: error.message,
                });
                await this.backoff(retries);
                retries++;
              } else {
                throw error;
              }
            }
          }
        },
        86400 // Cache for 24 hours
      );
    } catch (error) {
      this.errorCount++;
      Logger.error('Error generating Hugging Face embedding:', {
        error: error.message,
        errorCount: this.errorCount,
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
    const cacheKey = `hf_intent_${text.substring(0, 100).replace(/\s+/g, '_')}`;

    try {
      // Try to get from cache first
      return await CacheService.getOrFetch(
        cacheKey,
        async () => {
          // Use BART model for zero-shot classification
          const model = 'facebook/bart-large-mnli';

          let retries = 0;
          while (retries <= this.MAX_RETRIES) {
            try {
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
                    use_cache: true,
                  },
                }),
                // Add timeout to prevent hanging
                timeout: 10000,
              });

              if (!response.ok) {
                // Check for specific error types
                if (response.status === 429) {
                  // Rate limit hit
                  Logger.warn('Hugging Face rate limit hit, backing off');
                  await this.backoff(retries);
                  retries++;
                  continue;
                }

                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(
                  `Hugging Face API error: ${response.status} - ${JSON.stringify(error)}`
                );
              }

              // Parse classification result
              const result = await response.json();
              this.errorCount = 0; // Reset error count on success

              // Format the result to match our expected structure
              const intentResult = {
                type: result.labels[0],
                confidence: result.scores[0],
              };

              Logger.debug('Hugging Face intent classification result:', intentResult);
              return intentResult;
            } catch (error) {
              if (retries < this.MAX_RETRIES) {
                Logger.warn(`Hugging Face API error (retry ${retries + 1}/${this.MAX_RETRIES}):`, {
                  error: error.message,
                });
                await this.backoff(retries);
                retries++;
              } else {
                throw error;
              }
            }
          }
        },
        3600 // Cache for 1 hour
      );
    } catch (error) {
      this.errorCount++;
      Logger.error('Error classifying intent with Hugging Face:', {
        error: error.message,
        errorCount: this.errorCount,
      });
      throw error;
    }
  }

  /**
   * Implement exponential backoff for retries
   * @param {number} retryCount - The current retry count
   * @returns {Promise<void>}
   */
  static async backoff(retryCount) {
    const baseDelay = 1000; // 1 second
    const delay = baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 500; // Add random jitter to prevent synchronized retries
    await new Promise((resolve) => setTimeout(resolve, delay + jitter));
  }

  /**
   * Extract entities from text using a Hugging Face model
   * Enhanced with better fallback and caching
   * @param {string} text - Text to extract entities from
   * @param {string} intentType - The detected intent type
   * @returns {Promise<Object>} - Extracted entities
   */
  static async extractEntities(text, intentType) {
    const cacheKey = `hf_entities_${text.substring(0, 100).replace(/\s+/g, '_')}`;

    try {
      // Try to get from cache first
      return await CacheService.getOrFetch(
        cacheKey,
        async () => {
          // Try to use the API for entity extraction if available
          try {
            // Use a token classification model if we have enough API calls available
            if (this.errorCount < 3) {
              const response = await fetch(
                `https://api-inference.huggingface.co/models/dslim/bert-base-NER`,
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
                      use_cache: true,
                    },
                  }),
                  timeout: 10000,
                }
              );

              if (response.ok) {
                const nerResult = await response.json();

                // Process NER results into our entity format
                const result = {
                  metrics: [],
                };

                // Extract known entity types
                const entityMap = new Map();

                for (const entity of nerResult) {
                  const entityType = entity.entity_group;
                  const value = entity.word.replace(/^##/, '');

                  if (!entityMap.has(entityType)) {
                    entityMap.set(entityType, []);
                  }
                  entityMap.get(entityType).push(value);
                }

                // Try to map NER entities to our expected format
                if (entityMap.has('ORG')) {
                  result.coin_name = entityMap.get('ORG')[0];
                }

                // Still use regex patterns for specific metrics that NER might miss
                this.enhanceEntitiesWithRegex(text, result);

                return result;
              }
            }

            // Fallback to regex if API fails or we're conserving API calls
            return this.extractEntitiesWithRegex(text, intentType);
          } catch (error) {
            Logger.warn('Error using Hugging Face NER, falling back to regex:', {
              error: error.message,
            });
            return this.extractEntitiesWithRegex(text, intentType);
          }
        },
        3600 // Cache for 1 hour
      );
    } catch (error) {
      // If anything fails, use the regex fallback
      Logger.error('Error extracting entities:', {
        error: error.message,
      });
      return this.extractEntitiesWithRegex(text, intentType);
    }
  }

  /**
   * Extract entities using regex patterns (enhanced version)
   * @param {string} text - Text to extract entities from
   * @param {string} intentType - The detected intent type
   * @returns {Object} - Extracted entities
   */
  static extractEntitiesWithRegex(text, intentType) {
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
    if (text.match(/\bprice\b|\bcost\b|\bworth\b|\bvalue\b/i)) {
      result.metrics.push('price');
    }
    if (text.match(/\bholder(s)?\b|\binvestor(s)?\b|\bcommunity\b|\bown(er)?(s)?\b/i)) {
      result.metrics.push('holders');
    }
    if (text.match(/\bmarket\s*cap\b|\bcapitalization\b|\bmarket\s*value\b/i)) {
      result.metrics.push('market_cap');
    }
    if (text.match(/\bvolume\b|\btrading\b|\btransfer(s)?\b|\bactivity\b|\btransaction(s)?\b/i)) {
      result.metrics.push('transfers_24h');
    }
    if (text.match(/\brisk\b|\bsafe(ty)?\b|\bsecur(e|ity)\b|\bdanger\b/i)) {
      result.metrics.push('risk');
    }
    if (text.match(/\btrend\b|\bmoving\b|\bgrow(ing|th)\b|\bprediction\b|\bforecast\b/i)) {
      result.metrics.push('trend');
    }

    // Extract price thresholds
    const priceMatch = text.match(/(\d+(?:\.\d+)?)\s*(usd|dollars|\$|eth|bnb)/i);
    if (priceMatch) {
      const amount = parseFloat(priceMatch[1]);
      if (!result.thresholds) result.thresholds = {};
      result.thresholds.price = {
        operator: text.match(/\b(below|under|less\s*than)\b/i)
          ? '<'
          : text.match(/\b(above|over|more\s*than)\b/i)
          ? '>'
          : '<',
        value: amount,
      };
    }

    // Extract holder thresholds
    const holderMatch = text.match(/(\d+(?:,\d+)?(?:\.\d+)?)\s*k?\s*(holder|investor)/i);
    if (holderMatch) {
      let amount = parseFloat(holderMatch[1].replace(/,/g, ''));
      if (holderMatch[0].includes('k')) {
        amount *= 1000;
      }
      if (!result.thresholds) result.thresholds = {};
      result.thresholds.holders = {
        operator: text.match(/\b(below|under|less\s*than)\b/i)
          ? '<'
          : text.match(/\b(above|over|more\s*than)\b/i)
          ? '>'
          : '>',
        value: amount,
      };
    }

    // Extract market cap thresholds
    const mcapMatch = text.match(/(\d+(?:\.\d+)?)\s*(m|k|million|thousand|mln)?\s*(market\s*cap)/i);
    if (mcapMatch) {
      let amount = parseFloat(mcapMatch[1]);
      if (mcapMatch[2] && (mcapMatch[2] === 'm' || mcapMatch[2].includes('million'))) {
        amount *= 1000000;
      } else if (mcapMatch[2] && (mcapMatch[2] === 'k' || mcapMatch[2].includes('thousand'))) {
        amount *= 1000;
      }
      if (!result.thresholds) result.thresholds = {};
      result.thresholds.market_cap = {
        operator: text.match(/\b(below|under|less\s*than)\b/i)
          ? '<'
          : text.match(/\b(above|over|more\s*than)\b/i)
          ? '>'
          : '>',
        value: amount,
      };
    }

    // Extract coin names with better pattern matching
    const coinPatterns = [
      /\b(about|analyze|similar\s+to|like|compared\s+to)\s+([a-z0-9]+)/i,
      /\b([a-z0-9]{3,5})\s+(coin|token)/i,
      /\b(find|show|get)\s+([a-z0-9]+)/i,
    ];

    for (const pattern of coinPatterns) {
      const coinMatch = text.match(pattern);
      if (coinMatch && coinMatch[2]) {
        result.coin_name = coinMatch[2];
        break;
      }
    }

    return result;
  }

  /**
   * Enhance entities with additional regex patterns
   * @param {string} text - Original text
   * @param {Object} result - Entity object to enhance
   */
  static enhanceEntitiesWithRegex(text, result) {
    // Add any metrics not already found
    if (!result.metrics.includes('price') && text.match(/\bprice\b|\bcost\b|\bworth\b/i)) {
      result.metrics.push('price');
    }
    if (!result.metrics.includes('holders') && text.match(/\bholder(s)?\b|\bcommunity\b/i)) {
      result.metrics.push('holders');
    }
    if (!result.metrics.includes('market_cap') && text.match(/\bmarket\s*cap\b/i)) {
      result.metrics.push('market_cap');
    }
    if (
      !result.metrics.includes('transfers_24h') &&
      text.match(/\bvolume\b|\btrading\b|\btransfer(s)?\b/i)
    ) {
      result.metrics.push('transfers_24h');
    }

    // Extract blockchain if not already found
    if (!result.chain) {
      if (text.match(/\beth(ereum)?\b/i)) {
        result.chain = 'ETH';
      } else if (text.match(/\bbsc\b|\bbinance\b/i)) {
        result.chain = 'BSC';
      } else if (text.match(/\bnear\b/i)) {
        result.chain = 'NEAR';
      }
    }
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
      const entities = await this.extractEntities(query, intentResult.type);

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
        ...this.extractEntitiesWithRegex(query, type),
        original_query: query,
        is_fallback: true,
      };
    }
  }

  /**
   * Check service status and health
   * Useful for diagnostics and monitoring
   * @returns {Promise<Object>} - Status information
   */
  static async checkStatus() {
    try {
      const startTime = Date.now();

      // Make a simple API call to check if the service is responsive
      const response = await fetch('https://api-inference.huggingface.co/status', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 5000,
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        return {
          available: true,
          responseTime: responseTime,
          apiStatus: data.status || 'ok',
          errorCount: this.errorCount,
        };
      } else {
        return {
          available: false,
          responseTime: responseTime,
          error: `Status check failed with code ${response.status}`,
          errorCount: this.errorCount,
        };
      }
    } catch (error) {
      return {
        available: false,
        error: error.message,
        errorCount: this.errorCount,
      };
    }
  }
}

module.exports = HuggingFaceService;
