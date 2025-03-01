/**
 * NLPEngine provides natural language processing capabilities
 * for understanding and responding to user queries about meme coins.
 */
const OpenAI = require('openai');
const Logger = require('../services/logger');
const CacheService = require('../services/cache');
const AIProviderManager = require('../services/aiProvider');
const HuggingFaceService = require('../services/huggingface');
const Database = require('../database');

class NLPEngine {
  static openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  /**
   * Process a natural language query
   * @param {string} query - User's natural language query
   * @param {string} userId - User ID for rate limiting
   * @returns {Promise<Object>} - Processed query with intent and entities
   */
  static async processQuery(query, userId = 'anonymous') {
    try {
      Logger.info('Processing natural language query', { query: query.substring(0, 50) });

      // Try to detect intent
      const intent = await this.detectIntent(query, userId);

      if (!intent) {
        throw new Error('Failed to detect intent from query');
      }

      // Return the processed query
      return {
        ...intent,
        original_query: query,
      };
    } catch (error) {
      Logger.error('Error processing natural language query:', { error: error.message });

      // Use Hugging Face as a fallback
      try {
        Logger.info('Attempting to use Hugging Face for query processing');
        return await HuggingFaceService.processQuery(query);
      } catch (hfError) {
        Logger.error('Hugging Face fallback also failed:', { error: hfError.message });

        // If that also fails, use the basic regex fallback
        return {
          type: 'discovery',
          ...this.fallbackIntentDetection(query),
          original_query: query,
          is_fallback: true,
        };
      }
    }
  }

  /**
   * Detect the intent and entities in a user query
   * Now uses the AI Provider Manager for provider selection
   * @param {string} query - User's query
   * @param {string} userId - User ID for rate limiting
   * @returns {Object} - Detected intent and entities
   */
  static async detectIntent(query, userId = 'anonymous') {
    try {
      Logger.debug('Attempting to detect intent', { query: query.substring(0, 50) });

      const cacheKey = `intent_${query.toLowerCase().trim()}`;
      return await CacheService.getOrFetch(
        cacheKey,
        async () => {
          // Check if we should use OpenAI or fall back to Hugging Face
          try {
            // Let the AI Provider Manager decide which provider to use
            const provider = AIProviderManager.selectProvider('nlp', userId);

            if (provider === AIProviderManager.PROVIDERS.OPENAI) {
              const response = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo-0125', // Cost-efficient model
                messages: [
                  {
                    role: 'system',
                    content: `You are analyzing user queries about meme coins and cryptocurrency.
                  Determine the primary intent type and extract relevant entities.
                  Possible intent types: discovery (finding coins), analysis (analyzing specific coins),
                  comparison (comparing coins), or unknown.

                  For each intent, extract relevant entities such as:
                  - coin_name: Names or symbols of specific coins
                  - metrics: Metrics of interest (price, holders, market_cap, etc.)
                  - thresholds: Any thresholds or conditions mentioned (e.g., "over 1000 holders")
                  - chain: Blockchain name if specified (BSC, ETH, NEAR, etc.)
                  - time_period: Any time periods mentioned
                  - sort_criteria: How results should be sorted

                  Output JSON only.`,
                  },
                  {
                    role: 'user',
                    content: `Analyze this query and return a JSON object with intent type and entities: "${query}"`,
                  },
                ],
                response_format: { type: 'json_object' },
                temperature: 0.1, // Lower temperature for more consistent results
                max_tokens: 500,
              });

              try {
                return JSON.parse(response.choices[0].message.content);
              } catch (e) {
                Logger.error('Failed to parse intent JSON:', {
                  error: e.message,
                  response: response.choices[0].message.content,
                });
                throw e;
              }
            } else if (provider === AIProviderManager.PROVIDERS.HUGGINGFACE) {
              // Use Hugging Face for intent detection
              return await HuggingFaceService.processQuery(query);
            } else {
              // Use fallback intent detection
              return this.fallbackIntentDetection(query);
            }
          } catch (error) {
            Logger.error('Error in intent detection:', {
              error: error.message,
              statusCode: error.status || 'unknown',
            });

            if (error.status === 429) {
              Logger.warn('API rate limit reached, using fallback');
              AIProviderManager.handleProviderError(AIProviderManager.PROVIDERS.OPENAI, error);
            }

            // Attempt to use Hugging Face as a fallback
            try {
              return await HuggingFaceService.processQuery(query);
            } catch (hfError) {
              // If Hugging Face also fails, use the pure regex fallback
              return this.fallbackIntentDetection(query);
            }
          }
        },
        86400
      ); // Cache for 24 hours to reduce API calls
    } catch (error) {
      Logger.error('Error detecting intent:', { error: error.message });
      return this.fallbackIntentDetection(query);
    }
  }

  /**
   * Fallback method for intent detection when OpenAI API is unavailable
   * Uses simple pattern matching and keyword detection
   * @param {string} query - User's query
   * @returns {Object} - Detected intent and entities
   */
  static fallbackIntentDetection(query) {
    Logger.info('Using fallback intent detection for query', { query: query.substring(0, 50) });

    // Convert to lowercase for easier matching
    const q = query.toLowerCase();

    // Initialize results object
    const result = {
      type: 'unknown',
      metrics: [],
    };

    // Check for common blockchain names
    if (q.includes(' eth') || q.includes('ethereum')) {
      result.chain = 'ETH';
    } else if (q.includes(' bsc') || q.includes('binance')) {
      result.chain = 'BSC';
    } else if (q.includes(' near')) {
      result.chain = 'NEAR';
    }

    // Check for common metrics
    if (q.includes('price') || q.includes('cost') || q.includes('worth')) {
      result.metrics.push('price');
    }
    if (q.includes('holder') || q.includes('community')) {
      result.metrics.push('holders');
    }
    if (q.includes('market cap') || q.includes('marketcap')) {
      result.metrics.push('market_cap');
    }
    if (q.includes('volume') || q.includes('trading')) {
      result.metrics.push('transfers_24h');
    }

    // Detect intent type based on keywords
    if (
      q.includes('find') ||
      q.includes('discover') ||
      q.includes('search') ||
      q.includes('list') ||
      q.includes('show me') ||
      q.includes('what coins')
    ) {
      result.type = 'discovery';
    } else if (q.includes('analyze') || q.includes('details') || q.includes('about')) {
      result.type = 'analysis';

      // Try to extract coin name for analysis queries
      const coinMatches = q.match(/about\s+([^\s]+)|analyze\s+([^\s]+)|details\s+of\s+([^\s]+)/i);
      if (coinMatches) {
        const coinName = coinMatches[1] || coinMatches[2] || coinMatches[3];
        if (coinName) result.coin_name = coinName;
      }
    } else if (q.includes('compare') || q.includes('versus') || q.includes(' vs ')) {
      result.type = 'comparison';
    }

    // Default to discovery if we couldn't determine intent
    if (result.type === 'unknown') {
      result.type = 'discovery';
    }

    // If we identified the query as about buying with a specific amount
    if (q.includes('buy') || q.includes('purchase')) {
      result.type = 'discovery';

      // Try to extract price thresholds
      const priceMatches = q.match(/(\d+(?:\.\d+)?)\s*(usd|dollars|\$|eth|bnb)/i);
      if (priceMatches) {
        const amount = parseFloat(priceMatches[1]);
        const currency = priceMatches[2].toLowerCase();

        // Set threshold for discovery
        if (!result.thresholds) result.thresholds = {};

        // For simplicity, assume they want coins under this price
        result.thresholds.price = {
          operator: '<',
          value: amount,
        };
      }
    }

    Logger.debug('Fallback intent detection result', { result: JSON.stringify(result) });
    return result;
  }

  /**
   * Handle discovery-type queries (finding coins based on criteria)
   * @param {string} query - Original user query
   * @param {Object} intent - Detected intent and entities
   * @returns {Object} - Query results
   */
  static async handleDiscoveryQuery(query, intent) {
    try {
      // Get all coins from database
      const allCoins = await Database.get_all_coins();

      // Extract relevant filtering criteria from intent
      const { metrics = [], thresholds = {}, chain, time_period } = intent;

      // Start with all coins, then apply filters
      let filteredCoins = allCoins;

      // Filter by chain if specified
      if (chain) {
        filteredCoins = filteredCoins.filter(
          (c) => c.chain && c.chain.toLowerCase() === chain.toLowerCase()
        );
      }

      // Apply metric thresholds
      if (thresholds && Object.keys(thresholds).length > 0) {
        Object.entries(thresholds).forEach(([metric, condition]) => {
          const { operator, value } = condition;

          if (!operator || value === undefined) return;

          filteredCoins = filteredCoins.filter((coin) => {
            const coinValue = coin[metric];
            if (coinValue === undefined) return false;

            switch (operator) {
              case '>':
                return coinValue > value;
              case '<':
                return coinValue < value;
              case '>=':
                return coinValue >= value;
              case '<=':
                return coinValue <= value;
              case '=':
              case '==':
                return coinValue === value;
              default:
                return true;
            }
          });
        });
      }

      // Sort results based on intent or default to holders
      const sortBy = intent.sort_by || 'holders';
      const sortOrder = intent.sort_order || 'desc';

      filteredCoins.sort((a, b) => {
        const valA = a[sortBy] || 0;
        const valB = b[sortBy] || 0;
        return sortOrder === 'desc' ? valB - valA : valA - valB;
      });

      return {
        type: 'discovery',
        coins: filteredCoins.slice(0, 5), // Return top 5 results
        matchCount: filteredCoins.length,
        query: intent,
      };
    } catch (error) {
      Logger.error('Error in discovery query:', { error: error.message });
      return {
        type: 'error',
        message: 'Sorry, I encountered an error while searching for coins.',
      };
    }
  }

  /**
   * Handle analysis-type queries (analyzing specific coins)
   * @param {string} query - Original user query
   * @param {Object} intent - Detected intent and entities
   * @returns {Object} - Query results
   */
  static async handleAnalysisQuery(query, intent) {
    try {
      const { coin_name } = intent;

      if (!coin_name) {
        return {
          type: 'error',
          message: 'Please specify which coin you want to analyze.',
        };
      }

      // Search for the coin
      const coin = await Database.search_coin(coin_name);

      if (!coin) {
        return {
          type: 'not_found',
          message: `Could not find a coin matching '${coin_name}'. Try a different name or symbol.`,
        };
      }

      // Get historical data for the coin
      const historyData = await Database.get_historical_data(coin.contract, 'daily', 7);

      return {
        type: 'analysis',
        coin,
        historyData,
        metrics: intent.metrics || ['price', 'holders', 'market_cap'],
      };
    } catch (error) {
      Logger.error('Error in analysis query:', { error: error.message });
      return {
        type: 'error',
        message: 'Sorry, I encountered an error while analyzing the coin.',
      };
    }
  }

  /**
   * Handle comparison-type queries (comparing multiple coins)
   * @param {string} query - Original user query
   * @param {Object} intent - Detected intent and entities
   * @returns {Object} - Query results
   */
  static async handleComparisonQuery(query, intent) {
    try {
      const { coin_names } = intent;

      if (!coin_names || !Array.isArray(coin_names) || coin_names.length < 2) {
        return {
          type: 'error',
          message: 'Please specify at least two coins to compare.',
        };
      }

      // Find all the coins
      const coinPromises = coin_names.map((name) => Database.search_coin(name));
      const coins = (await Promise.all(coinPromises)).filter(Boolean);

      if (coins.length < 2) {
        return {
          type: 'not_found',
          message: 'Could not find enough of the specified coins to compare.',
        };
      }

      // Determine which metrics to compare
      const metrics = intent.metrics || ['price', 'holders', 'market_cap', 'transfers_24h'];

      return {
        type: 'comparison',
        coins,
        metrics,
      };
    } catch (error) {
      Logger.error('Error in comparison query:', { error: error.message });
      return {
        type: 'error',
        message: 'Sorry, I encountered an error while comparing the coins.',
      };
    }
  }
}

module.exports = NLPEngine;
