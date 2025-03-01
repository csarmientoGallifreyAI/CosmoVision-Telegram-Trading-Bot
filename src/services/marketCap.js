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
}

module.exports = MarketCapService;
