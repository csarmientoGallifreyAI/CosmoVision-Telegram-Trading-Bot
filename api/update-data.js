const Scraper = require('../src/scraper');
const Blockchain = require('../src/blockchain');
const Database = require('../src/database');
const Logger = require('../src/services/logger');
const AlertModel = require('../src/models/alertModel');
const MarketCapService = require('../src/services/marketCap');
const { Telegraf } = require('telegraf');

module.exports = async (req, res) => {
  Logger.info('Starting scheduled data update...');

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
    Logger.warn('Unauthorized access attempt to update data', {
      ip: req.headers['x-forwarded-for'],
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Initialize database
    Database.initialize_database();

    // Track stats
    const startTime = Date.now();
    let scraped_count = 0;
    let updated_count = 0;
    let market_cap_count = 0;
    let triggered_alerts = 0;

    // Run the scraper to get the latest coin data
    Logger.info('Running coin scraper...');
    const scraped_coins = await Scraper.scrape_gra_fun();
    scraped_count = scraped_coins.length;

    // Update blockchain data
    Logger.info('Updating blockchain data...');
    const updated_coins = await Blockchain.update_blockchain_data();
    updated_count = updated_coins.length;

    // Save a historical snapshot
    Logger.info('Saving historical snapshot...');
    await Database.save_historical_snapshot();

    // Update market caps
    Logger.info('Updating market caps...');
    const market_cap_updates = await MarketCapService.updateMarketCaps();
    market_cap_count = market_cap_updates.length;

    // Check for triggered alerts
    Logger.info('Checking for triggered alerts...');
    const alerts = await AlertModel.checkAlerts();
    triggered_alerts = alerts.length;

    // Send notifications for triggered alerts
    if (triggered_alerts > 0 && process.env.TELEGRAM_BOT_TOKEN) {
      await sendAlertNotifications(alerts);
    }

    // Close the database connection
    Database.close_connection();

    // Calculate runtime
    const runtime = ((Date.now() - startTime) / 1000).toFixed(2);

    // Send response
    Logger.info(
      `Data update completed in ${runtime}s. Scraped: ${scraped_count}, Updated blockchain: ${updated_count}, Market caps: ${market_cap_count}, Alerts: ${triggered_alerts}`
    );

    return res.status(200).json({
      status: 'success',
      message: 'Data update completed',
      stats: {
        runtime: `${runtime}s`,
        scraped: scraped_count,
        blockchain_updated: updated_count,
        market_caps_updated: market_cap_count,
        alerts_triggered: triggered_alerts,
      },
    });
  } catch (error) {
    Logger.error('Error updating data:', { error: error.message, stack: error.stack });

    // Ensure database connection is closed
    Database.close_connection();

    return res.status(500).json({
      status: 'error',
      message: 'Error updating data',
      error: error.message,
    });
  }
};

/**
 * Send notifications for triggered alerts
 * @param {Array} alerts - Array of triggered alerts
 */
async function sendAlertNotifications(alerts) {
  if (!alerts || alerts.length === 0) return;

  try {
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // Group alerts by user to reduce notifications
    const userAlerts = {};

    for (const alert of alerts) {
      if (!userAlerts[alert.user_id]) {
        userAlerts[alert.user_id] = [];
      }
      userAlerts[alert.user_id].push(alert);
    }

    // Send notifications to each user
    for (const [userId, userAlertList] of Object.entries(userAlerts)) {
      try {
        let message = '🚨 *Alert Triggered!*\n\n';

        for (const alert of userAlertList) {
          const conditionSymbol = getConditionSymbol(alert.condition);
          const currentValue = getAlertMetricValue(alert);

          message += `${alert.name} (${alert.symbol}): ${alert.metric} is now ${currentValue} ${conditionSymbol} your threshold of ${alert.threshold}\n\n`;
        }

        message += 'Use /myalerts to view all your active alerts.';

        await bot.telegram.sendMessage(userId, message, { parse_mode: 'Markdown' });
        Logger.info(`Sent alert notification to user ${userId} for ${userAlertList.length} alerts`);
      } catch (userError) {
        Logger.error(`Failed to send alert to user ${userId}:`, { error: userError.message });
      }
    }
  } catch (error) {
    Logger.error('Error sending alert notifications:', { error: error.message });
  }
}

/**
 * Get condition symbol for display
 * @param {string} condition - Condition code
 * @returns {string} Human-readable symbol
 */
function getConditionSymbol(condition) {
  switch (condition) {
    case 'gt':
      return '>';
    case 'lt':
      return '<';
    case 'eq':
      return '=';
    case 'gte':
      return '>=';
    case 'lte':
      return '<=';
    default:
      return condition;
  }
}

/**
 * Get the current value of the alert metric
 * @param {Object} alert - Alert object with coin data
 * @returns {string} Formatted metric value
 */
function getAlertMetricValue(alert) {
  const value = alert[alert.metric];

  switch (alert.metric) {
    case 'price':
      return `$${value.toFixed(value < 0.01 ? 8 : 2)}`;
    case 'market_cap':
      return `$${formatNumberShort(value)}`;
    case 'holders':
    case 'transfers_24h':
      return value.toLocaleString();
    default:
      return value;
  }
}

/**
 * Format a number with K, M, B suffixes
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumberShort(num) {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(2) + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  }
  return num.toFixed(2);
}
