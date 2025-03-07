/**
 * Market Cap calculation service
 * Calculates and updates market cap data for coins
 */
const BscChain = require('../blockchain/chains/bsc');
const NearChain = require('../blockchain/chains/near');
const Database = require('../database');
const Logger = require('./logger');

class MarketCapService {
  /**
   * Update market caps for all coins in the database
   * @returns {Promise<Array>} Array of updated coins
   */
  static async updateMarketCaps() {
    Logger.info('Updating market caps for all coins...');

    try {
      if (!Database.db) {
        Database.initialize_database();
      }

      // Get all coins from database
      const coins = await Database.get_all_coins();

      if (!coins || coins.length === 0) {
        Logger.info('No coins found in database to update market caps');
        return [];
      }

      Logger.info(`Found ${coins.length} coins for market cap update`);

      // Track successfully updated coins
      const updatedCoins = [];

      // Process each coin
      for (const coin of coins) {
        try {
          // Skip coins without necessary data
          if (!coin.contract || !coin.price) {
            Logger.debug(`Skipping ${coin.name} due to missing contract or price data`);
            continue;
          }

          let totalSupply = null;

          // Get supply based on chain
          if (!coin.chain || coin.chain === 'BSC') {
            totalSupply = await BscChain.getTokenSupply(coin.contract);
          } else if (coin.chain === 'NEAR') {
            totalSupply = await NearChain.getTokenSupply(coin.contract);
          }

          // Calculate market cap if we have both price and supply
          if (totalSupply && coin.price) {
            const marketCap = totalSupply * coin.price;

            // Update the coin in the database with market cap
            await Database.updateCoinMarketCap(coin.contract, marketCap);

            // Add to updated coins list for stats
            const updatedCoin = { ...coin, market_cap: marketCap };
            updatedCoins.push(updatedCoin);

            Logger.info(`Updated market cap for ${coin.name}: $${marketCap.toLocaleString()}`);
          } else {
            Logger.warn(`Could not calculate market cap for ${coin.name} - missing supply data`);
          }
        } catch (error) {
          Logger.error(`Error updating market cap for ${coin.name}:`, {
            coin: coin.name,
            contract: coin.contract,
            error: error.message,
          });
        }
      }

      Logger.info(`Successfully updated market caps for ${updatedCoins.length} coins`);
      return updatedCoins;
    } catch (error) {
      Logger.error('Error in market cap update process', { error: error.message });
      throw error;
    }
  }

  /**
   * Get top coins by market cap
   * @param {number} limit - Maximum number of coins to return
   * @param {Object} options - Additional options
   * @param {string} options.chain - Filter by specific blockchain (BSC, ETH, etc.)
   * @param {number} options.minMarketCap - Minimum market cap to include
   * @param {number} options.minHolders - Minimum holders to include
   * @returns {Promise<Array>} - Array of top coins
   */
  static async getTopCoins(limit = 20, options = {}) {
    try {
      Logger.info(`Getting top ${limit} coins by market cap`);

      if (!Database.db) {
        Database.initialize_database();
      }

      // Build query with filters
      let query = `
        SELECT * FROM coins
        WHERE market_cap IS NOT NULL AND market_cap > 0 AND price > 0
      `;

      const queryParams = [];

      // Add chain filter if specified
      if (options.chain) {
        query += ` AND chain = ?`;
        queryParams.push(options.chain);
      }

      // Add market cap filter if specified
      if (options.minMarketCap) {
        query += ` AND market_cap >= ?`;
        queryParams.push(options.minMarketCap);
      }

      // Add holders filter if specified
      if (options.minHolders) {
        query += ` AND holders >= ?`;
        queryParams.push(options.minHolders);
      }

      // Order by market cap and limit results
      query += ` ORDER BY market_cap DESC LIMIT ?`;
      queryParams.push(limit);

      // Execute query
      const stmt = Database.db.prepare(query);
      const coins = stmt.all(...queryParams);

      Logger.info(`Found ${coins.length} top coins by market cap`);
      return coins;
    } catch (error) {
      Logger.error('Error getting top coins by market cap', { error: error.message });
      return [];
    }
  }

  /**
   * Get coins above a minimum market cap threshold
   * @param {number} minMarketCap - Minimum market cap in USD
   * @param {number} limit - Maximum number of coins to return
   * @param {Object} options - Additional filter options
   * @returns {Promise<Array>} - Array of filtered coins
   */
  static async getCoinsAboveMarketCap(minMarketCap = 60000, limit = 50, options = {}) {
    try {
      Logger.info(`Getting coins with market cap above $${minMarketCap}`);

      if (!Database.db) {
        Database.initialize_database();
      }

      // Build query with filters
      let query = `
        SELECT * FROM coins
        WHERE market_cap IS NOT NULL AND market_cap >= ? AND price > 0
      `;

      const queryParams = [minMarketCap];

      // Add chain filter if specified
      if (options.chain) {
        query += ` AND chain = ?`;
        queryParams.push(options.chain);
      }

      // Add holder filter if specified
      if (options.minHolders) {
        query += ` AND holders >= ?`;
        queryParams.push(options.minHolders);
      }

      // Add activity filter based on transfers_24h
      if (options.minTransfers) {
        query += ` AND transfers_24h >= ?`;
        queryParams.push(options.minTransfers);
      }

      // Order by market cap and limit results
      query += ` ORDER BY market_cap DESC LIMIT ?`;
      queryParams.push(limit);

      // Execute query
      const stmt = Database.db.prepare(query);
      const coins = stmt.all(...queryParams);

      Logger.info(`Found ${coins.length} coins with market cap above $${minMarketCap}`);
      return coins;
    } catch (error) {
      Logger.error('Error fetching coins by market cap:', {
        error: error.message,
        threshold: minMarketCap,
      });
      return [];
    }
  }
}

module.exports = MarketCapService;
