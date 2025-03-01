/**
 * Generate embeddings for all coins in the database
 * This script can be run as a background job to precompute embeddings
 *
 * Usage:
 * npm run generate-embeddings [-- --limit=N --delay=MS]
 *   --limit=N   : Process only N coins (default: all)
 *   --delay=MS  : Delay between batches in milliseconds (default: 1000)
 */
require('dotenv').config();
const Database = require('../src/database');
const { SimilarityEngine } = require('../src/ai');
const Logger = require('../src/services/logger');

async function generateAllEmbeddings() {
  try {
    // Parse command line arguments
    const args = parseArgs();
    Logger.info('Starting embedding generation with options:', args);

    // Initialize database
    Database.initialize_database();

    // Get all coins or limit if specified
    const allCoins = await Database.get_all_coins();
    const coinsToProcess = args.limit ? allCoins.slice(0, args.limit) : allCoins;

    Logger.info(
      `Will process ${coinsToProcess.length} of ${allCoins.length} coins with ${args.delay}ms delay between batches`
    );

    // Configure the SimilarityEngine with our custom options
    if (args.delay !== 1000) {
      Logger.info(`Setting custom batch delay to ${args.delay}ms`);
      // Create a custom updateAllEmbeddings function with our delay
      const customUpdateFn = async () => {
        let successful = 0;
        let failed = 0;
        let skipped = 0;

        // Process coins in smaller batches to avoid rate limits
        const batchSize = 5;

        for (let i = 0; i < coinsToProcess.length; i += batchSize) {
          const batch = coinsToProcess.slice(i, i + batchSize);

          // Log progress periodically
          if (i % 20 === 0 || i + batch.length >= coinsToProcess.length) {
            Logger.info(
              `Processing embeddings: ${i + 1}-${Math.min(
                i + batch.length,
                coinsToProcess.length
              )} of ${coinsToProcess.length}`
            );
          }

          // Process batch concurrently
          const results = await Promise.allSettled(
            batch.map(async (coin) => {
              try {
                // Check if we need to update (based on last_updated timestamp)
                const existingEmbedding = await Database.getEmbedding(coin.contract);
                if (existingEmbedding) {
                  return { status: 'skipped', coin };
                }

                // Generate new embedding
                await SimilarityEngine.generateCoinEmbedding(coin);
                return { status: 'success', coin };
              } catch (error) {
                Logger.error(`Error generating embedding for ${coin.name}:`, {
                  error: error.message,
                });
                return { status: 'failed', coin, error };
              }
            })
          );

          // Count results
          results.forEach((result) => {
            if (result.status === 'fulfilled') {
              if (result.value.status === 'success') successful++;
              else if (result.value.status === 'skipped') skipped++;
              else failed++;
            } else {
              failed++;
            }
          });

          // Add delay between batches to respect rate limits
          if (i + batchSize < coinsToProcess.length) {
            await new Promise((resolve) => setTimeout(resolve, args.delay));
          }
        }

        return { successful, skipped, failed, total: coinsToProcess.length };
      };

      // Use our custom function
      return await customUpdateFn();
    } else {
      // Use the built-in method from SimilarityEngine
      return await SimilarityEngine.updateAllEmbeddings();
    }
  } catch (error) {
    Logger.error('Fatal error in embedding generation:', {
      error: error.message,
      stack: error.stack,
    });

    // Ensure database connection is closed
    Database.close_connection();

    throw error;
  } finally {
    // Always close the database connection
    Database.close_connection();
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = {
    limit: null, // Process all coins by default
    delay: 1000, // Default delay between batches
  };

  // Get arguments from process.argv
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--limit=')) {
      const limit = parseInt(arg.split('=')[1], 10);
      if (!isNaN(limit) && limit > 0) {
        args.limit = limit;
      }
    } else if (arg.startsWith('--delay=')) {
      const delay = parseInt(arg.split('=')[1], 10);
      if (!isNaN(delay) && delay >= 0) {
        args.delay = delay;
      }
    }
  });

  return args;
}

// Run the function if this script is executed directly
if (require.main === module) {
  generateAllEmbeddings()
    .then((result) => {
      Logger.info('Embedding generation script completed successfully', result);
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
