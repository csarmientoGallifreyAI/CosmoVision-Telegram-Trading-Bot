const fetch = require('node-fetch');
const Database = require('./database');
const Logger = require('./services/logger');
const BscChain = require('./blockchain/chains/bsc');
const NearChain = require('./blockchain/chains/near');

class Scraper {
  /**
   * Identify the blockchain based on contract address format
   * @param {string} contractAddress - Contract address to identify
   * @returns {string} Chain identifier (BSC, NEAR, etc.)
   */
  static identifyChain(contractAddress) {
    // NEAR addresses typically contain dots or end with .near
    if (contractAddress.includes('.')) {
      return 'NEAR';
    }
    // BSC addresses are 0x prefixed hexadecimal, 42 chars (0x + 40 hex chars)
    if (/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      return 'BSC';
    }
    // Default to BSC if we can't identify
    return 'BSC';
  }

  /**
   * Scrape coin data from gra.fun API
   * @returns {Promise<Array>} Array of scraped coins
   */
  static async scrape_gra_fun() {
    Logger.info('Starting to scrape gra.fun for coin data...');
    const coins_scraped = [];

    try {
      // Fetch the top meme coins from gra.fun
      const response = await fetch('https://api.gra.fun/top_meme_coins', {
        timeout: 10000, // Set a reasonable timeout
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        Logger.error('Failed to parse API response as JSON', {
          error: jsonError.message,
          responseText: await response.text().slice(0, 200), // Sample of response
        });
        throw jsonError;
      }

      Logger.info(`Received data for ${data.length} coins from gra.fun`);

      // Process each coin with improved error handling
      for (const coin of data) {
        try {
          // Validation before processing
          if (!coin.name || !coin.symbol || !coin.contract_address) {
            Logger.warn('Skipping coin with missing required fields', {
              coin: JSON.stringify(coin),
            });
            continue;
          }

          // Identify the blockchain
          const chain = this.identifyChain(coin.contract_address);

          const coin_data = {
            name: coin.name,
            symbol: coin.symbol,
            contract: coin.contract_address,
            price: parseFloat(coin.price_usd) || 0,
            holders: parseInt(coin.holders) || 0,
            transfers_24h: parseInt(coin.transfers_24h) || 0,
            chain: chain,
          };

          // Insert or update the coin in the database
          await Database.upsert_coin(coin_data);
          coins_scraped.push(coin_data);

          Logger.info(
            `Successfully processed coin: ${coin_data.name} (${coin_data.symbol}) on ${chain}`
          );
        } catch (error) {
          Logger.error(`Error processing coin ${coin.name || 'unknown'}`, {
            error: error.message,
            stack: error.stack,
            coin: JSON.stringify(coin),
          });
          // Continue with next coin instead of failing the entire batch
        }
      }

      Logger.info(`Successfully scraped ${coins_scraped.length} coins from gra.fun`);
      return coins_scraped;
    } catch (error) {
      Logger.error('Fatal error in scraper', {
        error: error.message,
        stack: error.stack,
      });
      return coins_scraped; // Return any coins we managed to scrape
    }
  }

  /**
   * Run the scraper and process results
   * @param {boolean} test_mode - Whether to run in test mode
   * @returns {Promise<Array>} Array of scraped coins
   */
  static async run_scraper(test_mode = false) {
    Logger.info(`Starting scraper${test_mode ? ' in test mode' : ''}...`);

    try {
      // Initialize the database
      Database.initialize_database();

      // Scrape gra.fun
      const coins = await this.scrape_gra_fun();

      // Save a historical snapshot of current data
      await Database.save_historical_snapshot();

      Logger.info(`Scraper completed. Processed ${coins.length} coins.`);

      // Close the database connection
      Database.close_connection();

      return coins;
    } catch (error) {
      Logger.error('Error running scraper:', {
        error: error.message,
        stack: error.stack,
      });

      // Ensure database connection is closed even if there's an error
      Database.close_connection();

      throw error;
    }
  }
}

module.exports = Scraper;
