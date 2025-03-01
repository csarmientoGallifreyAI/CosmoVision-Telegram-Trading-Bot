/**
 * NEAR chain adapter for blockchain interactions
 */
const { connect } = require('near-api-js');
const Logger = require('../../services/logger');
const CacheService = require('../../services/cache');

class NearChain {
  static nearConnection = null;

  /**
   * Initialize connection to NEAR blockchain
   * Establishes and caches a connection to the NEAR RPC endpoint
   * @returns {Promise<Object>} NEAR connection object
   */
  static async getConnection() {
    try {
      if (this.nearConnection) {
        return this.nearConnection;
      }

      Logger.info('Initializing NEAR connection...');

      const config = {
        networkId: 'mainnet',
        nodeUrl: 'https://rpc.mainnet.near.org',
        headers: {},
      };

      this.nearConnection = await connect(config);
      return this.nearConnection;
    } catch (error) {
      Logger.error('Failed to connect to NEAR network', { error: error.message });
      throw error;
    }
  }

  /**
   * Get token holder information for a contract
   * @param {string} contract - The token contract address on NEAR
   * @returns {Promise<number|null>} The number of holders or null if unavailable
   */
  static async getTokenHolders(contract) {
    try {
      // Use cache to reduce API calls
      const cacheKey = `near_holders_${contract}`;
      return await CacheService.getOrFetch(
        cacheKey,
        async () => {
          const near = await this.getConnection();
          const account = await near.account('example.near');

          // For NEAR, we need a specialized approach since there's no direct holders API
          // This is a simplified implementation that may need adjusting based on the token contract
          try {
            // First attempt to get ft_metadata to verify it's a token contract
            const metadata = await account.viewFunction({
              contractId: contract,
              methodName: 'ft_metadata',
              args: {},
            });

            // Here we would need to get holder information
            // For a real implementation, you might need to:
            // 1. Use an indexer API that tracks token holders
            // 2. Or query a specialized service that provides this data

            // For now, return a placeholder
            return null;
          } catch (viewError) {
            Logger.warn(`Failed to verify ${contract} is a token contract`, {
              error: viewError.message,
            });
            return null;
          }
        },
        3600
      ); // Cache for 1 hour
    } catch (error) {
      Logger.error('Error fetching NEAR token holders', {
        contract,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get transfer count over time period
   * @param {string} contract - The token contract address on NEAR
   * @param {number} timespan - Timespan in seconds (default 24h)
   * @returns {Promise<number|null>} The number of transfers or null if unavailable
   */
  static async getTransferCount(contract, timespan = 86400) {
    try {
      // Use cache to reduce API calls
      const cacheKey = `near_transfers_${contract}_${timespan}`;
      return await CacheService.getOrFetch(
        cacheKey,
        async () => {
          // NEAR doesn't have a direct API for this
          // Would require an indexer service that tracks ft_transfer events

          // Alternative: could use NEAR Explorer API if available
          // For now, return a placeholder
          return null;
        },
        3600
      ); // Cache for 1 hour
    } catch (error) {
      Logger.error('Error fetching NEAR token transfers', {
        contract,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get token supply for market cap calculation
   * @param {string} contract - The token contract address on NEAR
   * @returns {Promise<number|null>} The token supply or null if unavailable
   */
  static async getTokenSupply(contract) {
    try {
      // Use cache to reduce API calls
      const cacheKey = `near_supply_${contract}`;
      return await CacheService.getOrFetch(
        cacheKey,
        async () => {
          const near = await this.getConnection();
          const account = await near.account('example.near');

          try {
            // For FT contracts, we can call ft_total_supply
            const totalSupplyRaw = await account.viewFunction({
              contractId: contract,
              methodName: 'ft_total_supply',
              args: {},
            });

            // Convert from string to number
            const totalSupply = parseFloat(totalSupplyRaw);

            // Get decimals to adjust the supply
            const metadata = await account.viewFunction({
              contractId: contract,
              methodName: 'ft_metadata',
              args: {},
            });

            const decimals = metadata?.decimals || 18;

            // Adjust supply based on decimals
            return totalSupply / Math.pow(10, decimals);
          } catch (viewError) {
            Logger.warn(`Failed to get supply for ${contract}`, {
              error: viewError.message,
            });
            return null;
          }
        },
        3600 * 6
      ); // Cache for 6 hours
    } catch (error) {
      Logger.error('Error fetching NEAR token supply', {
        contract,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Determine if an address is a valid NEAR contract
   * @param {string} address - Address to validate
   * @returns {Promise<boolean>} True if valid, false otherwise
   */
  static async isValidContract(address) {
    try {
      // Check if address has the NEAR format (typically with .near suffix)
      if (!address.includes('.')) {
        return false;
      }

      // Attempt to query the account
      const near = await this.getConnection();
      const account = await near.account(address);

      // If we can access account details, it exists
      await account.state();
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = NearChain;
