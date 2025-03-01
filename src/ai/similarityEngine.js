/**
 * SimilarityEngine provides embedding-based recommendation functionality
 * for finding similar coins based on their characteristics.
 */
const OpenAI = require('openai');
const Database = require('../database');
const CacheService = require('../services/cache');
const Logger = require('../services/logger');
const HuggingFaceService = require('../services/huggingface');
const AIProviderManager = require('../services/aiProvider');
const RateLimitService = require('../services/rateLimit');

class SimilarityEngine {
  static openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  /**
   * Maximum number of retries for API calls
   * @type {number}
   */
  static MAX_RETRIES = 3;

  /**
   * Generates or retrieves an embedding vector for a coin
   * Enhanced with Hugging Face fallback
   * @param {Object} coin - Coin object with properties
   * @param {string} userId - User ID for rate limiting (optional)
   * @returns {Array} - The embedding vector
   */
  static async generateCoinEmbedding(coin, userId = 'system') {
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

      // Try to get from cache or database before calling API
      return await CacheService.getOrFetch(
        cacheKey,
        async () => {
          // Try to get from database first
          const storedEmbedding = await Database.getEmbedding(coin.contract);
          if (storedEmbedding) {
            Logger.debug(`Retrieved embedding from database for ${coin.name}`);
            return storedEmbedding;
          }

          // If not in DB, generate new embedding via API
          Logger.info(`Generating new embedding for ${coin.name}`);

          // Let the AI Provider Manager decide which provider to use
          const provider = AIProviderManager.selectProvider('embedding', userId);

          if (provider === AIProviderManager.PROVIDERS.OPENAI) {
            // Try with retries for OpenAI
            for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
              try {
                const response = await this.openai.embeddings.create({
                  model: 'text-embedding-3-small',
                  input: context,
                  dimensions: 256, // Lower dimensionality for efficiency
                });

                const embedding = response.data[0].embedding;

                // Store in database for future use
                await Database.saveEmbedding(coin.contract, embedding);

                return embedding;
              } catch (apiError) {
                // If we've exhausted retries or it's not a rate limit error, try Hugging Face
                if (attempt === this.MAX_RETRIES || apiError.status !== 429) {
                  Logger.error(`Failed to generate OpenAI embedding after ${attempt} attempts:`, {
                    error: apiError.message,
                    coin: coin.name,
                    status: apiError.status,
                  });

                  // Update provider status in the AI Provider Manager
                  AIProviderManager.handleProviderError(
                    AIProviderManager.PROVIDERS.OPENAI,
                    apiError
                  );

                  // Try Hugging Face instead
                  try {
                    return await this.generateEmbeddingWithHuggingFace(context, coin);
                  } catch (hfError) {
                    // If Hugging Face also fails, use fallback method
                    Logger.error('Hugging Face embedding also failed:', {
                      error: hfError.message,
                      coin: coin.name,
                    });
                    return this.generateFallbackEmbedding(coin);
                  }
                }

                // Exponential backoff for rate limit errors
                const delay = Math.pow(2, attempt) * 1000;
                Logger.warn(
                  `Rate limit hit, retrying in ${delay}ms (attempt ${attempt}/${this.MAX_RETRIES})`,
                  {
                    coin: coin.name,
                    error: apiError.message,
                  }
                );
                await new Promise((resolve) => setTimeout(resolve, delay));
              }
            }
          } else if (provider === AIProviderManager.PROVIDERS.HUGGINGFACE) {
            // Use Hugging Face for embedding generation
            try {
              return await this.generateEmbeddingWithHuggingFace(context, coin);
            } catch (hfError) {
              Logger.error('Hugging Face embedding failed:', {
                error: hfError.message,
                coin: coin.name,
              });

              // Update provider status in the AI Provider Manager
              AIProviderManager.handleProviderError(
                AIProviderManager.PROVIDERS.HUGGINGFACE,
                hfError
              );

              return this.generateFallbackEmbedding(coin);
            }
          } else {
            // Use the fallback method for embedding generation
            return this.generateFallbackEmbedding(coin);
          }

          // Should not reach here normally, but just in case
          return this.generateFallbackEmbedding(coin);
        },
        86400
      ); // Cache for 24 hours
    } catch (error) {
      Logger.error('Error generating coin embedding:', { error: error.message, coin: coin.name });
      return this.generateFallbackEmbedding(coin);
    }
  }

  /**
   * Generate embedding using Hugging Face
   * @param {string} context - Text to generate embedding for
   * @param {Object} coin - Coin object (for logging and storing)
   * @returns {Promise<Array<number>>} - The embedding vector
   */
  static async generateEmbeddingWithHuggingFace(context, coin) {
    try {
      Logger.info(`Generating embedding with Hugging Face for ${coin.name}`);

      const embedding = await HuggingFaceService.generateEmbedding(context);

      // Store in database for future use
      await Database.saveEmbedding(coin.contract, embedding);

      return embedding;
    } catch (error) {
      Logger.error('Error generating Hugging Face embedding:', {
        error: error.message,
        coin: coin.name,
      });
      throw error;
    }
  }

  /**
   * Generate a deterministic embedding without using OpenAI API
   * This is a fallback method when the API is unavailable
   * @param {Object} coin - Coin object
   * @returns {Array} - A deterministic pseudo-embedding
   */
  static generateFallbackEmbedding(coin) {
    Logger.info(`Using fallback embedding generation for ${coin.name}`);

    // Create a deterministic seed based on coin properties
    const seed = `${coin.name}:${coin.symbol}:${coin.chain || 'BSC'}:${coin.contract}`;

    // Generate a simple deterministic vector using the seed
    // This is not as good as a real embedding, but will allow basic functionality
    const embedding = new Array(256);

    // Simple hash function to generate a number from a string
    const hash = (str) => {
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        h = (h << 5) - h + str.charCodeAt(i);
        h |= 0; // Convert to 32bit integer
      }
      return h;
    };

    // Fill the embedding with deterministic but somewhat random-looking values
    for (let i = 0; i < embedding.length; i++) {
      // Use a different "salt" for each position to create different values
      const positionSeed = hash(`${seed}:${i}`);
      // Generate a value between -1 and 1 (typical for embeddings)
      embedding[i] = (positionSeed % 1000) / 500 - 1;
    }

    // Normalize the vector (important for cosine similarity calculations)
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] = embedding[i] / magnitude;
    }

    return embedding;
  }

  /**
   * Finds coins similar to the target coin
   * @param {string} coinContract - Contract address of the target coin
   * @param {number} limit - Maximum number of similar coins to return
   * @param {string} userId - User ID for rate limiting
   * @returns {Array} - Array of similar coin objects
   */
  static async findSimilarCoins(coinContract, limit = 5, userId = 'anonymous') {
    try {
      // Check if this user is rate-limited for similarity operations
      if (!RateLimitService.canMakeRequest(userId, 'similarity')) {
        Logger.warn(`Rate limit reached for user ${userId} on similarity operations`);
        return []; // Return empty array if rate-limited
      }

      // Track this request for rate limiting
      RateLimitService.incrementRequestCount(userId, 'similarity');

      // First try to get the target coin
      const allCoins = await Database.get_all_coins();
      const targetCoin = allCoins.find((c) => c.contract === coinContract);

      if (!targetCoin) {
        Logger.warn(`Target coin not found: ${coinContract}`);
        return [];
      }

      // Try to get target embedding from database first
      let targetEmbedding = await Database.getEmbedding(coinContract);

      // If no stored embedding, generate it
      if (!targetEmbedding) {
        Logger.info(`No stored embedding found for ${targetCoin.name}, generating now`);
        targetEmbedding = await this.generateCoinEmbedding(targetCoin, userId);
      }

      // Get all precomputed embeddings from the database
      const allEmbeddings = await Database.getAllEmbeddings();
      Logger.debug(`Found ${allEmbeddings.length} precomputed embeddings for comparison`);

      if (allEmbeddings.length === 0) {
        Logger.warn('No precomputed embeddings found. Run generate-embeddings script first.');
        return [];
      }

      // Calculate similarities using precomputed embeddings
      const similarities = allEmbeddings
        .filter((item) => item.contract !== coinContract) // Exclude the target coin
        .map((item) => ({
          coin: {
            contract: item.contract,
            name: item.name,
            symbol: item.symbol,
            // We'll need to add complete coin data
          },
          similarity: this.cosineSimilarity(targetEmbedding, item.embedding),
        }));

      // Enrich coin data with complete information
      for (const item of similarities) {
        const fullCoin = allCoins.find((c) => c.contract === item.coin.contract);
        if (fullCoin) {
          item.coin = fullCoin;
        }
      }

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

  /**
   * Updates embeddings for all coins in the database
   * To be used in batch processing scripts
   * @returns {Object} - Statistics about the update
   */
  static async updateAllEmbeddings() {
    try {
      Logger.info('Starting batch update of all coin embeddings');
      const allCoins = await Database.get_all_coins();

      let successful = 0;
      let failed = 0;
      let skipped = 0;

      // Process coins in smaller batches to avoid rate limits
      const batchSize = 10;

      for (let i = 0; i < allCoins.length; i += batchSize) {
        const batch = allCoins.slice(i, i + batchSize);

        // Log progress periodically
        if (i % 50 === 0 || i + batch.length >= allCoins.length) {
          Logger.info(
            `Processing embeddings: ${i + 1}-${Math.min(i + batch.length, allCoins.length)} of ${
              allCoins.length
            }`
          );
        }

        // Process batch concurrently
        const results = await Promise.allSettled(
          batch.map(async (coin) => {
            // Check if we need to update (based on last_updated timestamp)
            const existingEmbedding = await Database.getEmbedding(coin.contract);
            if (existingEmbedding) {
              // We could add logic here to only update if the coin has changed
              // For now, we'll skip existing embeddings to save API calls
              return { status: 'skipped', coin };
            }

            // Generate new embedding
            const embedding = await this.generateCoinEmbedding(coin);
            return { status: 'success', coin };
          })
        );

        // Count results
        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            if (result.value.status === 'success') successful++;
            else if (result.value.status === 'skipped') skipped++;
          } else {
            failed++;
          }
        });

        // Add delay between batches to respect rate limits
        if (i + batchSize < allCoins.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      Logger.info(
        `Embedding update complete: ${successful} generated, ${skipped} skipped, ${failed} failed`
      );
      return { successful, skipped, failed, total: allCoins.length };
    } catch (error) {
      Logger.error('Error in batch embedding update:', { error: error.message });
      throw error;
    }
  }
}

module.exports = SimilarityEngine;
