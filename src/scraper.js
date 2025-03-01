const fetch = require('node-fetch');
const Database = require('./database');

class Scraper {
  static async scrape_gra_fun() {
    console.log('Starting to scrape gra.fun for coin data...');
    const coins_scraped = [];

    try {
      // Fetch the top meme coins from gra.fun
      const response = await fetch('https://api.gra.fun/top_meme_coins');

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      console.log(`Received data for ${data.length} coins from gra.fun`);

      // Process each coin
      for (const coin of data) {
        try {
          const coin_data = {
            name: coin.name,
            symbol: coin.symbol,
            contract: coin.contract_address,
            price: parseFloat(coin.price_usd) || 0,
            holders: parseInt(coin.holders) || 0,
            transfers_24h: parseInt(coin.transfers_24h) || 0,
          };

          // Validate required fields
          if (!coin_data.name || !coin_data.symbol || !coin_data.contract) {
            console.warn('Skipping coin with missing required fields:', coin_data);
            continue;
          }

          // Insert or update the coin in the database
          await Database.upsert_coin(coin_data);
          coins_scraped.push(coin_data);

          console.log(`Successfully processed coin: ${coin_data.name} (${coin_data.symbol})`);
        } catch (error) {
          console.error(`Error processing coin ${coin.name || 'unknown'}:`, error);
        }
      }

      console.log(`Successfully scraped ${coins_scraped.length} coins from gra.fun`);
      return coins_scraped;
    } catch (error) {
      console.error('Error scraping gra.fun:', error);
      return coins_scraped; // Return any coins we managed to scrape before the error
    }
  }

  static async run_scraper(test_mode = false) {
    console.log(`Starting scraper${test_mode ? ' in test mode' : ''}...`);

    try {
      // Initialize the database
      Database.initialize_database();

      // Scrape gra.fun
      const coins = await this.scrape_gra_fun();

      console.log(`Scraper completed. Processed ${coins.length} coins.`);

      // Close the database connection
      Database.close_connection();

      return coins;
    } catch (error) {
      console.error('Error running scraper:', error);

      // Ensure database connection is closed even if there's an error
      Database.close_connection();

      throw error;
    }
  }
}

module.exports = Scraper;
