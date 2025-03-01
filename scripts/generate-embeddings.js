/**
 * Generate embeddings for all coins in the database
 * This script can be run as a background job to precompute embeddings
 */
require('dotenv').config();
const Database = require('../src/database');
const { SimilarityEngine } = require('../src/ai');
const Logger = require('../src/services/logger');

async function generateAllEmbeddings() {
  try {
    Logger.info('Starting embedding generation for all coins');

    // Initialize database
    Database.initialize_database();

    // Get all coins
    const coins = await Database.get_all_coins();
    Logger.info(`Found ${coins.length} coins in database`);

    let successCount = 0;
    let errorCount = 0;

    // Process coins in batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < coins.length; i += batchSize) {
      const batch = coins.slice(i, i + batchSize);

      // Process batch in parallel
      const promises = batch.map(async (coin) => {
        try {
          Logger.debug(`Generating embedding for ${coin.name} (${coin.symbol})`);
          const embedding = await SimilarityEngine.generateCoinEmbedding(coin);

          if (embedding) {
            successCount++;
            Logger.debug(`Successfully generated embedding for ${coin.name}`);
          } else {
            errorCount++;
            Logger.warn(`Failed to generate embedding for ${coin.name}`);
          }
        } catch (error) {
          errorCount++;
          Logger.error(`Error generating embedding for ${coin.name}:`, { error: error.message });
        }
      });

      // Wait for batch to complete
      await Promise.all(promises);

      // Log progress
      Logger.info(`Processed ${Math.min(i + batchSize, coins.length)}/${coins.length} coins`);

      // Add a small delay between batches to respect API rate limits
      if (i + batchSize < coins.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    Logger.info(`Embedding generation complete. Success: ${successCount}, Errors: ${errorCount}`);

    // Close database connection
    Database.close_connection();
  } catch (error) {
    Logger.error('Fatal error in embedding generation:', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  generateAllEmbeddings()
    .then(() => {
      Logger.info('Embedding generation script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      Logger.error('Embedding generation script failed:', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });
}

module.exports = generateAllEmbeddings;
