/**
 * NLPEngine provides natural language processing capabilities
 * for understanding and responding to user queries about meme coins.
 */
const { OpenAI } = require('openai');
const Database = require('../database');
const CacheService = require('../services/cache');
const Logger = require('../services/logger');

class NLPEngine {
  static openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  /**
   * Process a natural language query to extract intent and provide results
   * @param {string} query - User's natural language query
   * @returns {Object} - Query results with detected intent
   */
  static async processQuery(query) {
    try {
      Logger.info('Processing NLP query', { query: query.substring(0, 100) });

      // Use cache for identical queries
      const cacheKey = `nlp_query_${query.toLowerCase().trim()}`;
      return await CacheService.getOrFetch(
        cacheKey,
        async () => {
          // First, detect the intent of the query
          const intent = await this.detectIntent(query);
          Logger.debug('Detected intent', { intent: JSON.stringify(intent) });

          // Handle different intent types
          switch (intent.type) {
            case 'discovery':
              return await this.handleDiscoveryQuery(query, intent);
            case 'analysis':
              return await this.handleAnalysisQuery(query, intent);
            case 'comparison':
              return await this.handleComparisonQuery(query, intent);
            default:
              return {
                type: 'unknown',
                message:
                  "I'm not sure what you're asking. Try asking about specific coins or metrics.",
              };
          }
        },
        3600
      ); // Cache for 1 hour
    } catch (error) {
      Logger.error('Error processing NLP query:', { error: error.message, query });
      return {
        type: 'error',
        message: 'Sorry, I encountered an error while processing your query.',
      };
    }
  }

  /**
   * Detect the intent and entities in a user query
   * @param {string} query - User's query
   * @returns {Object} - Detected intent and entities
   */
  static async detectIntent(query) {
    try {
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
        return { type: 'unknown' };
      }
    } catch (error) {
      Logger.error('Error detecting intent:', { error: error.message });
      return { type: 'unknown' };
    }
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
