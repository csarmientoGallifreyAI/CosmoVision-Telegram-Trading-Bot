const fetch = require('node-fetch');
const Database = require('./database');

class Blockchain {
  // Configuration
  static etherscan_api_key = process.env.ETHERSCAN_API_KEY || '';

  static async update_blockchain_data() {
    console.log('Starting blockchain data update...');
    const updated_coins = [];

    try {
      // Get all coins from the database
      const coins = await Database.get_all_coins();

      if (!coins || coins.length === 0) {
        console.log('No coins found in database to update');
        return updated_coins;
      }

      console.log(`Found ${coins.length} coins in database to update`);

      // Process each coin - fetch blockchain data
      for (const coin of coins) {
        try {
          // Skip coins without contract addresses
          if (!coin.contract) {
            console.warn(`Skipping coin ${coin.name} (${coin.symbol}) - no contract address`);
            continue;
          }

          // Fetch holder count from Etherscan (example)
          const holders = await this.get_token_holder_count(coin.contract);

          // Fetch transfer count for last 24 hours
          const transfers_24h = await this.get_token_transfers_24h(coin.contract);

          // Update the database with new data
          const updated_data = {
            ...coin,
            holders: holders || coin.holders,
            transfers_24h: transfers_24h || coin.transfers_24h,
          };

          await Database.upsert_coin(updated_data);
          updated_coins.push(updated_data);

          console.log(`Updated blockchain data for ${coin.name} (${coin.symbol})`);
        } catch (error) {
          console.error(`Error updating blockchain data for coin ${coin.name}:`, error);
        }
      }

      console.log(`Successfully updated blockchain data for ${updated_coins.length} coins`);
      return updated_coins;
    } catch (error) {
      console.error('Error in blockchain data update:', error);
      return updated_coins;
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
