/**
 * BSC (Binance Smart Chain) adapter for blockchain interactions
 */
const fetch = require('node-fetch');
const Logger = require('../../services/logger');
const CacheService = require('../../services/cache');

class BscChain {
  static etherscan_api_key = process.env.ETHERSCAN_API_KEY || '';

  /**
   * Get the number of token holders for a contract
   * @param {string} contract_address - The token contract address
   * @returns {Promise<number|null>} The number of holders or null if unavailable
   */
  static async getTokenHolders(contract_address) {
    if (!this.etherscan_api_key) {
      Logger.warn('ETHERSCAN_API_KEY not set - unable to fetch holder count');
      return null;
    }

    try {
      // Use cache to reduce API calls
      const cacheKey = `bsc_holders_${contract_address}`;
      return await CacheService.getOrFetch(
        cacheKey,
        async () => {
          const url = `https://api.bscscan.com/api?module=token&action=tokenholderlist&contractaddress=${contract_address}&page=1&offset=1&apikey=${this.etherscan_api_key}`;

          const response = await fetch(url, { timeout: 10000 });
          if (!response.ok) {
            throw new Error(
              `Failed to fetch holder count: ${response.status} ${response.statusText}`
            );
          }

          const data = await response.json();

          // This is just a placeholder - actual implementation may vary based on specific API
          if (data.status === '1' && data.message === 'OK') {
            return parseInt(data.result.length) || null;
          }

          return null;
        },
        3600
      ); // Cache for 1 hour
    } catch (error) {
      Logger.error('Error fetching BSC token holder count', {
        contract: contract_address,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get the number of token transfers in the last 24 hours
   * @param {string} contract_address - The token contract address
   * @returns {Promise<number|null>} The number of transfers or null if unavailable
   */
  static async getTransferCount(contract_address, timespan = 86400) {
    if (!this.etherscan_api_key) {
      Logger.warn('ETHERSCAN_API_KEY not set - unable to fetch transfer count');
      return null;
    }

    try {
      // Use cache to reduce API calls
      const cacheKey = `bsc_transfers_${contract_address}_${timespan}`;
      return await CacheService.getOrFetch(
        cacheKey,
        async () => {
          // Calculate timestamp for specified timespan ago (default 24h)
          const timestamp_ago = Math.floor(Date.now() / 1000) - timespan;

          const url = `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${contract_address}&startblock=0&endblock=999999999&sort=asc&apikey=${this.etherscan_api_key}`;

          const response = await fetch(url, { timeout: 10000 });
          if (!response.ok) {
            throw new Error(`Failed to fetch transfers: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();

          if (data.status === '1' && data.message === 'OK') {
            // Filter transfers in the specified timespan
            const recent_transfers = data.result.filter(
              (tx) => parseInt(tx.timeStamp) >= timestamp_ago
            );

            return recent_transfers.length;
          }

          return null;
        },
        3600
      ); // Cache for 1 hour
    } catch (error) {
      Logger.error('Error fetching BSC token transfers', {
        contract: contract_address,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get the token supply for market cap calculation
   * @param {string} contract_address - The token contract address
   * @returns {Promise<number|null>} The token supply or null if unavailable
   */
  static async getTokenSupply(contract_address) {
    if (!this.etherscan_api_key) {
      Logger.warn('ETHERSCAN_API_KEY not set - unable to fetch token supply');
      return null;
    }

    try {
      // Use cache to reduce API calls
      const cacheKey = `bsc_supply_${contract_address}`;
      return await CacheService.getOrFetch(
        cacheKey,
        async () => {
          const url = `https://api.bscscan.com/api?module=stats&action=tokensupply&contractaddress=${contract_address}&apikey=${this.etherscan_api_key}`;

          const response = await fetch(url, { timeout: 10000 });
          if (!response.ok) {
            throw new Error(
              `Failed to fetch token supply: ${response.status} ${response.statusText}`
            );
          }

          const data = await response.json();

          if (data.status === '1' && data.message === 'OK') {
            // Convert result to a number (removing potential scientific notation)
            const supply = parseFloat(data.result);
            return isNaN(supply) ? null : supply;
          }

          return null;
        },
        3600 * 6
      ); // Cache for 6 hours
    } catch (error) {
      Logger.error('Error fetching BSC token supply', {
        contract: contract_address,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Batch multiple token data requests for efficiency
   * @param {string[]} contracts - Array of contract addresses
   * @returns {Promise<Object>} Object with contract addresses as keys and data as values
   */
  static async batchGetTokenData(contracts) {
    if (!this.etherscan_api_key || contracts.length === 0) {
      return {};
    }

    // Group contracts into batches of 20 (BscScan limit)
    const batches = [];
    for (let i = 0; i < contracts.length; i += 20) {
      batches.push(contracts.slice(i, i + 20));
    }

    const results = {};

    for (const batch of batches) {
      try {
        // Process batch - can expand this to include other operations
        for (const contract of batch) {
          results[contract] = {
            supply: await this.getTokenSupply(contract),
          };
        }

        // Respect rate limits with a delay between batches
        if (batches.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        Logger.error('Error in batch processing', { error: error.message });
      }
    }

    return results;
  }
}

module.exports = BscChain;
