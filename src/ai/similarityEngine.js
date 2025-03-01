/**
 * SimilarityEngine provides embedding-based recommendation functionality
 * for finding similar coins based on their characteristics.
 */
const { OpenAI } = require('openai');
const Database = require('../database');
const CacheService = require('../services/cache');
const Logger = require('../services/logger');

class SimilarityEngine {
  static openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  /**
   * Generates or retrieves an embedding vector for a coin
   * @param {Object} coin - Coin object with properties
   * @returns {Array} - The embedding vector
   */
  static async generateCoinEmbedding(coin) {
    try {
      // Create a descriptive context of coin features for the embedding
      const context = `
        Name: ${coin.name}
        Symbol: ${coin.symbol}
        Chain: ${coin.chain || 'BSC'}
        Price: ${coin.price || 0}
        Holders: ${coin.holders || 0}
        Transfers24h: ${coin.transfers_24h || 0}
        ActivityRatio: ${coin.holders ? (coin.transfers_24h / coin.holders).toFixed(5) : '0'}
        MarketCap: ${coin.market_cap || 0}
      `;

      // Cache key includes last_updated to invalidate when coin data changes
      const cacheKey = `embedding_${coin.contract}_${coin.last_updated}`;

      // Try to get from cache or database before calling OpenAI API
      return await CacheService.getOrFetch(
        cacheKey,
        async () => {
          // Try to get from database first
          const storedEmbedding = await Database.getEmbedding(coin.contract);
          if (storedEmbedding) {
            Logger.debug(`Retrieved embedding from database for ${coin.name}`);
            return storedEmbedding;
          }

          // If not in DB, generate new embedding via OpenAI
          Logger.info(`Generating new embedding for ${coin.name}`);
          const response = await this.openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: context,
            dimensions: 256, // Lower dimensionality for efficiency
          });

          const embedding = response.data[0].embedding;

          // Store in database for future use
          await Database.saveEmbedding(coin.contract, embedding);

          return embedding;
        },
        86400
      ); // Cache for 24 hours
    } catch (error) {
      Logger.error('Error generating coin embedding:', { error: error.message, coin: coin.name });
      // Return empty embedding to prevent cascade failures
      return Array(256).fill(0);
    }
  }

  /**
   * Finds coins similar to the target coin
   * @param {string} coinContract - Contract address of the target coin
   * @param {number} limit - Maximum number of similar coins to return
   * @returns {Array} - Array of similar coin objects
   */
  static async findSimilarCoins(coinContract, limit = 5) {
    try {
      const allCoins = await Database.get_all_coins();
      const targetCoin = allCoins.find((c) => c.contract === coinContract);

      if (!targetCoin) {
        Logger.warn(`Target coin not found: ${coinContract}`);
        return [];
      }

      // Generate embedding for target coin
      const targetEmbedding = await this.generateCoinEmbedding(targetCoin);

      // Calculate similarity scores in parallel
      const similarities = await Promise.all(
        allCoins
          .filter((c) => c.contract !== coinContract)
          .map(async (coin) => {
            const embedding = await this.generateCoinEmbedding(coin);
            const similarity = this.cosineSimilarity(targetEmbedding, embedding);
            return { coin, similarity };
          })
      );

      // Sort by similarity score (descending) and return top matches
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map((item) => item.coin);
    } catch (error) {
      Logger.error('Error finding similar coins:', {
        error: error.message,
        contract: coinContract,
      });
      return [];
    }
  }

  /**
   * Calculates cosine similarity between two vectors
   * @param {Array} vec1 - First embedding vector
   * @param {Array} vec2 - Second embedding vector
   * @returns {number} - Similarity score (0-1)
   */
  static cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) {
      return 0; // Handle invalid inputs
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }

    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);

    if (mag1 === 0 || mag2 === 0) return 0;

    return dotProduct / (mag1 * mag2);
  }
}

module.exports = SimilarityEngine;
