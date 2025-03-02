/**
 * Trading Data Update Endpoint
 *
 * Handles updating trading signals, expiring old signals, and checking outcomes.
 * This endpoint should be called periodically (e.g., hourly) to keep
 * trading signals fresh and accurate.
 */

const TradingService = require('../src/services/trading');
const TradeModel = require('../src/models/tradeModel');
const Database = require('../src/database');
const Logger = require('../src/services/logger');

module.exports = async (req, res) => {
  Logger.info('Starting trading data update...');

  // Verify this request is authorized
  const auth_key = req.headers['x-auth-key'] || '';
  const expected_key = process.env.UPDATE_AUTH_KEY || '';

  if (auth_key !== expected_key) {
    Logger.warn('Unauthorized access attempt to update trading data', {
      ip: req.headers['x-forwarded-for'],
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Ensure database is initialized
    Database.initialize_database();

    // Initialize tables if needed
    await TradeModel.createTables();

    // Generate new trading signals
    Logger.info('Generating new trading signals');
    const signals = await TradingService.generateDailySignals();

    // Expire old signals
    Logger.info('Expiring old signals');
    const expiredCount = await TradeModel.expireOldSignals();

    // Check outcomes of previously expired signals
    Logger.info('Checking outcomes of expired signals');
    const outcomeCount = await TradeModel.checkAndUpdateSignalOutcomes();

    Logger.info('Trading data update completed successfully', {
      newSignals: signals.length,
      expiredSignals: expiredCount,
      outcomeUpdates: outcomeCount,
    });

    return res.status(200).json({
      status: 'success',
      message: 'Trading data updated successfully',
      stats: {
        newSignals: signals.length,
        expiredSignals: expiredCount,
        outcomeUpdates: outcomeCount,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    Logger.error('Error updating trading data:', { error: error.message, stack: error.stack });

    // Ensure database connection is closed on error
    try {
      Database.close_connection();
    } catch (dbError) {
      // Ignore any errors during close
    }

    return res.status(500).json({
      status: 'error',
      message: 'Error updating trading data',
      error: error.message,
    });
  } finally {
    // Always ensure database connection is closed
    try {
      Database.close_connection();
    } catch (dbError) {
      // Ignore any errors during close
    }
  }
};
