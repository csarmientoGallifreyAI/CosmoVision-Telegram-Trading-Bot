const Scraper = require('../src/scraper');
const Blockchain = require('../src/blockchain');
const Database = require('../src/database');

module.exports = async (req, res) => {
  console.log('Starting scheduled data update...');

  // Verify this is a scheduled job (if using Vercel Cron)
  // Or validate an authorization key
  const auth_key = req.headers['x-auth-key'] || '';
  const expected_key = process.env.UPDATE_AUTH_KEY || '';

  if (
    // Either it's a Vercel cron job
    req.headers['x-vercel-cron'] !== 'true' &&
    // Or it has a valid auth key
    auth_key !== expected_key
  ) {
    console.warn('Unauthorized access attempt to update data');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Initialize database
    Database.initialize_database();

    // Track stats
    const startTime = Date.now();
    let scraped_count = 0;
    let updated_count = 0;

    // Run the scraper to get the latest coin data
    console.log('Running coin scraper...');
    const scraped_coins = await Scraper.scrape_gra_fun();
    scraped_count = scraped_coins.length;

    // Update blockchain data
    console.log('Updating blockchain data...');
    const updated_coins = await Blockchain.update_blockchain_data();
    updated_count = updated_coins.length;

    // Close the database connection
    Database.close_connection();

    // Calculate runtime
    const runtime = ((Date.now() - startTime) / 1000).toFixed(2);

    // Send response
    console.log(
      `Data update completed in ${runtime}s. Scraped: ${scraped_count}, Updated blockchain: ${updated_count}`
    );
    return res.status(200).json({
      status: 'success',
      message: 'Data update completed',
      stats: {
        runtime: `${runtime}s`,
        scraped: scraped_count,
        blockchain_updated: updated_count,
      },
    });
  } catch (error) {
    console.error('Error updating data:', error);

    // Ensure database connection is closed
    Database.close_connection();

    return res.status(500).json({
      status: 'error',
      message: 'Error updating data',
      error: error.message,
    });
  }
};
