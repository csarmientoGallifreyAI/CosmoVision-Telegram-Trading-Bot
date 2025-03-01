const Logger = require('../src/services/logger');
const Database = require('../src/database');
const BscChain = require('../src/blockchain/chains/bsc');
const NearChain = require('../src/blockchain/chains/near');
const CacheService = require('../src/services/cache');

/**
 * Test API endpoint for checking basic functionality
 */
module.exports = async (req, res) => {
  Logger.info('Test endpoint called');

  try {
    // Check database connection
    Database.initialize_database();

    // Gather system status
    const status = {
      database: {
        initialized: Database.db !== null,
        path: process.env.VERCEL === '1' ? '/tmp/coins.db' : 'src/data/coins.db',
      },
      api: {
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development',
      },
      cache: CacheService.getStats(),
      features: {
        near_support: true,
        market_cap: true,
        alerts: true,
        enhanced_responses: true,
      },
      chains: {
        bsc: {
          config_complete: !!process.env.ETHERSCAN_API_KEY,
        },
        near: {
          available: true,
        },
      },
    };

    // Count coins in database
    try {
      const coins = await Database.get_all_coins();
      status.database.coin_count = coins ? coins.length : 0;

      // Count by chain
      const chainCounts = {};
      for (const coin of coins || []) {
        const chain = coin.chain || 'BSC';
        chainCounts[chain] = (chainCounts[chain] || 0) + 1;
      }
      status.database.chains = chainCounts;
    } catch (dbError) {
      status.database.error = dbError.message;
    }

    // Close database connection
    Database.close_connection();

    // Return success response with status
    return res.status(200).json({
      status: 'success',
      message: 'API is operational',
      data: status,
    });
  } catch (error) {
    Logger.error('Error in test endpoint:', { error: error.message });

    // Ensure database connection is closed
    Database.close_connection();

    return res.status(500).json({
      status: 'error',
      message: 'Test endpoint error',
      error: error.message,
    });
  }
};
