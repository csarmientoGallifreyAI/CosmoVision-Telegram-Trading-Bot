const fetch = require('node-fetch');
const Database = require('./database');
const Logger = require('./services/logger');
const BscChain = require('./blockchain/chains/bsc');
const NearChain = require('./blockchain/chains/near');
const MarketCapService = require('./services/marketCap');

class Blockchain {
  // Configuration
  static etherscan_api_key = process.env.ETHERSCAN_API_KEY || '';

  /**
   * Update blockchain data for all coins in the database
   * @returns {Promise<Array>} Array of updated coins
   */
  static async update_blockchain_data() {
    Logger.info('Starting blockchain data update...');
    const updated_coins = [];

    try {
      // Get all coins from the database
      const coins = await Database.get_all_coins();

      if (!coins || coins.length === 0) {
        Logger.warn('No coins found in database to update');
        return updated_coins;
      }

      Logger.info(`Found ${coins.length} coins in database to update`);

      // Process each coin - fetch blockchain data
      for (const coin of coins) {
        try {
          // Skip coins without contract addresses
          if (!coin.contract) {
            Logger.warn(`Skipping coin ${coin.name} (${coin.symbol}) - no contract address`);
            continue;
          }

          let holders = null;
          let transfers_24h = null;

          // Use the appropriate chain adapter based on coin.chain
          if (!coin.chain || coin.chain === 'BSC') {
            holders = await BscChain.getTokenHolders(coin.contract);
            transfers_24h = await BscChain.getTransferCount(coin.contract);
          } else if (coin.chain === 'NEAR') {
            holders = await NearChain.getTokenHolders(coin.contract);
            transfers_24h = await NearChain.getTransferCount(coin.contract);
          } else {
            Logger.warn(
              `Unknown chain ${coin.chain} for ${coin.name}, unable to fetch blockchain data`
            );
          }

          // Update the database with new data
          const updated_data = {
            ...coin,
            holders: holders || coin.holders,
            transfers_24h: transfers_24h || coin.transfers_24h,
          };

          await Database.upsert_coin(updated_data);
          updated_coins.push(updated_data);

          Logger.info(
            `Updated blockchain data for ${coin.name} (${coin.symbol}) on ${coin.chain || 'BSC'}`
          );
        } catch (error) {
          Logger.error(`Error updating blockchain data for coin ${coin.name}:`, {
            contract: coin.contract,
            chain: coin.chain,
            error: error.message,
          });
        }
      }

      // After updating blockchain data, update market caps
      Logger.info('Updating market caps for all coins...');
      const marketCapUpdates = await MarketCapService.updateMarketCaps();

      Logger.info(`Successfully updated blockchain data for ${updated_coins.length} coins`);
      Logger.info(`Updated market caps for ${marketCapUpdates.length} coins`);

      return updated_coins;
    } catch (error) {
      Logger.error('Error in blockchain data update:', { error: error.message });
      return updated_coins;
    }
  }

  /**
   * Check for NEAR asset validity
   * @param {string} address - NEAR address to check
   * @returns {Promise<boolean>} True if valid NEAR contract
   */
  static async validateNearAsset(address) {
    try {
      return await NearChain.isValidContract(address);
    } catch (error) {
      Logger.error('Error validating NEAR asset', { address, error: error.message });
      return false;
    }
  }

  static async get_token_holder_count(contract_address) {
    // In a full implementation, this would call Etherscan API to get holder count
    // For now, we'll simulate it with a placeholder
    if (!this.etherscan_api_key) {
      console.warn('ETHERSCAN_API_KEY not set - using mock data for holders');
      return null;
    }

    try {
      const url = `https://api.etherscan.io/api?module=token&action=tokenholderlist&contractaddress=${contract_address}&page=1&offset=1&apikey=${this.etherscan_api_key}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch holder count: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Extract holder count from response (specific to Etherscan API)
      // Note: This is a simplified example, actual implementation may differ
      if (data.status === '1' && data.message === 'OK') {
        // This is just a sample - Etherscan doesn't directly provide holder count this way
        return parseInt(data.result.length) || null;
      }

      return null;
    } catch (error) {
      console.error('Error fetching token holder count:', error);
      return null;
    }
  }

  static async get_token_transfers_24h(contract_address) {
    // In a full implementation, this would call Etherscan API to get transfer count
    // For now, we'll simulate it with a placeholder
    if (!this.etherscan_api_key) {
      console.warn('ETHERSCAN_API_KEY not set - using mock data for transfers');
      return null;
    }

    try {
      // Calculate timestamp for 24 hours ago
      const timestamp_24h_ago = Math.floor(Date.now() / 1000) - 24 * 60 * 60;

      const url = `https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=${contract_address}&startblock=0&endblock=999999999&sort=asc&apikey=${this.etherscan_api_key}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch transfers: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Extract transfer count from response (specific to Etherscan API)
      if (data.status === '1' && data.message === 'OK') {
        // Filter transfers in the last 24 hours
        const recent_transfers = data.result.filter(
          (tx) => parseInt(tx.timeStamp) >= timestamp_24h_ago
        );

        return recent_transfers.length;
      }

      return null;
    } catch (error) {
      console.error('Error fetching token transfers:', error);
      return null;
    }
  }
}

module.exports = Blockchain;
