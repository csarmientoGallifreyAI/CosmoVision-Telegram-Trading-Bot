const { Telegraf } = require('telegraf');
const Database = require('../src/database');
const Scraper = require('../src/scraper');
const Blockchain = require('../src/blockchain');
const Logger = require('../src/services/logger');
const AlertModel = require('../src/models/alertModel');
const {
  formatTimestamp,
  formatNumber,
  formatPrice,
  formatMarketCap,
  getChangeIndicator,
  getExplorerLink,
} = require('../src/utils/formatters');

// Initialize database and alert table
Database.initialize_database();
AlertModel.createTable().catch((err) => {
  Logger.error('Failed to create alerts table:', { error: err.message });
});

module.exports = async (req, res) => {
  Logger.info('Webhook received. Processing update...');

  // Verify method is POST
  if (req.method !== 'POST') {
    Logger.warn(`Received ${req.method} request instead of POST`);
    return res.status(200).send('This endpoint accepts POST requests from Telegram only');
  }

  try {
    // Initialize bot instance
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // Log the update for debugging
    Logger.debug('Update received:', { body: JSON.stringify(req.body).substring(0, 200) + '...' });

    // Register handlers (these run for each webhook request)
    registerBotHandlers(bot);

    // Process the update
    await bot.handleUpdate(req.body);

    // Return success
    return res.status(200).send('OK');
  } catch (error) {
    Logger.error('Error processing webhook:', { error: error.message, stack: error.stack });

    // Still return 200 to prevent Telegram from retrying
    return res.status(200).send('Error occurred, but acknowledged');
  }
};

function registerBotHandlers(bot) {
  // Register bot handlers (similar to what was in telegram_bot.py)
  bot.start((ctx) => {
    return ctx.reply(
      `Hello ${ctx.from.first_name}! Welcome to the Meme Coin Analysis Bot.\n\n` +
        `Use /analyze <coin_name> or /analyze <symbol> to get metrics for a specific coin.\n\n` +
        `You can also set alerts with /setalert command.\n\n` +
        `Example: /analyze DOGE`
    );
  });

  bot.help((ctx) => {
    return ctx.reply(
      'Meme Coin Analysis Bot Commands:\n\n' +
        '/analyze <coin_name> - Get analysis for a specific coin\n' +
        '/setalert <coin> <metric> <condition> <threshold> - Set an alert\n' +
        '/myalerts - View your active alerts\n' +
        '/removealert <number> - Remove an alert\n' +
        '/help - Show this help message\n' +
        '/start - Start the bot'
    );
  });

  bot.command('analyze', async (ctx) => {
    const query = ctx.message.text.split(' ').slice(1).join(' ').trim();
    Logger.info(`User ${ctx.from.id} searching for coin: ${query}`);

    if (!query) {
      return ctx.reply('Please provide a coin name or symbol.\nExample: /analyze DOGE');
    }

    // Search for the coin
    try {
      const coin = await Database.search_coin(query);

      if (coin) {
        // Get historical data for change indicators
        const historyData = await Database.get_historical_data(coin.contract, 'daily', 2);

        // Format response with enhanced formatting
        const response = formatCoinResponse(coin, historyData);
        return ctx.reply(response, { parse_mode: 'Markdown' });
      } else {
        return ctx.reply(
          `Could not find a coin matching '${query}'. Try a different name or symbol.`
        );
      }
    } catch (error) {
      Logger.error(`Error analyzing coin '${query}':`, { error: error.message });
      return ctx.reply('Sorry, an error occurred while processing your request.');
    }
  });

  // Alert commands
  bot.command('setalert', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);

    if (args.length < 4) {
      return ctx.reply(
        'Usage: /setalert <coin> <metric> <condition> <threshold>\n\n' +
          'Example: /setalert DOGE price gt 0.1\n\n' +
          'Available metrics: price, holders, transfers_24h, market_cap\n' +
          'Available conditions: gt (>), lt (<), eq (=), gte (>=), lte (<=)'
      );
    }

    const [coinQuery, metric, condition, thresholdStr] = args;
    const threshold = parseFloat(thresholdStr);

    if (isNaN(threshold)) {
      return ctx.reply('Threshold must be a number.');
    }

    // Validate metric
    const validMetrics = ['price', 'holders', 'transfers_24h', 'market_cap'];
    if (!validMetrics.includes(metric)) {
      return ctx.reply(`Invalid metric. Choose from: ${validMetrics.join(', ')}`);
    }

    // Validate condition
    const validConditions = ['gt', 'lt', 'eq', 'gte', 'lte'];
    if (!validConditions.includes(condition)) {
      return ctx.reply(`Invalid condition. Choose from: ${validConditions.join(', ')}`);
    }

    // Check threshold validity
    if (threshold <= 0 && ['price', 'holders', 'transfers_24h', 'market_cap'].includes(metric)) {
      return ctx.reply('Threshold must be greater than zero for this metric.');
    }

    // Find coin
    try {
      const coin = await Database.search_coin(coinQuery);
      if (!coin) {
        return ctx.reply(`Could not find a coin matching '${coinQuery}'.`);
      }

      // Check alert count limit
      const userAlerts = await AlertModel.getUserAlerts(ctx.from.id);
      if (userAlerts.length >= 10) {
        return ctx.reply(
          'You have reached the maximum number of alerts (10). Please remove some before adding more.'
        );
      }

      // Create alert
      await AlertModel.createAlert(ctx.from.id, coin.contract, metric, condition, threshold);

      return ctx.reply(
        `✅ Alert set: You'll be notified when ${coin.name} ${metric} ${condition} ${threshold}`
      );
    } catch (error) {
      Logger.error('Error setting alert:', { error: error.message, user: ctx.from.id });
      return ctx.reply('Sorry, an error occurred while setting the alert.');
    }
  });

  bot.command('myalerts', async (ctx) => {
    try {
      const alerts = await AlertModel.getUserAlerts(ctx.from.id);

      if (!alerts.length) {
        return ctx.reply('You have no alerts set. Use /setalert to create one.');
      }

      const alertsList = alerts
        .map((a, i) => {
          const metricValue = formatAlertMetricValue(a.metric, a.threshold);
          return `${i + 1}. ${a.name} (${a.symbol}): ${a.metric} ${a.condition} ${metricValue}`;
        })
        .join('\n');

      return ctx.reply(
        `Your Alerts:\n\n${alertsList}\n\nUse /removealert <number> to remove an alert.`
      );
    } catch (error) {
      Logger.error('Error fetching alerts:', { error: error.message, user: ctx.from.id });
      return ctx.reply('Sorry, an error occurred while fetching your alerts.');
    }
  });

  bot.command('removealert', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);

    if (args.length < 1 || isNaN(parseInt(args[0]))) {
      return ctx.reply('Please specify the alert number to remove.\nExample: /removealert 1');
    }

    const alertNumber = parseInt(args[0]);

    try {
      const alerts = await AlertModel.getUserAlerts(ctx.from.id);

      if (!alerts.length) {
        return ctx.reply('You have no alerts to remove.');
      }

      if (alertNumber < 1 || alertNumber > alerts.length) {
        return ctx.reply(`Please provide a valid alert number between 1 and ${alerts.length}.`);
      }

      const alertToRemove = alerts[alertNumber - 1];

      await AlertModel.removeAlert(alertToRemove.id, ctx.from.id);

      return ctx.reply(
        `✅ Alert removed: ${alertToRemove.name} ${alertToRemove.metric} ${alertToRemove.condition} ${alertToRemove.threshold}`
      );
    } catch (error) {
      Logger.error('Error removing alert:', { error: error.message, user: ctx.from.id });
      return ctx.reply('Sorry, an error occurred while removing the alert.');
    }
  });

  // Handle unexpected errors
  bot.catch((err, ctx) => {
    Logger.error('Bot error:', { error: err.message, update: ctx.update });
    ctx.reply('Sorry, an error occurred while processing your request.');
  });
}

function formatCoinResponse(coin, historyData = []) {
  // Get change indicators if we have historical data
  const prevData = historyData.length > 1 ? historyData[1] : null;
  const priceChange = prevData && coin.price ? getChangeIndicator(prevData.price, coin.price) : '';
  const holdersChange =
    prevData && coin.holders ? getChangeIndicator(prevData.holders, coin.holders) : '';
  const transfersChange =
    prevData && coin.transfers_24h
      ? getChangeIndicator(prevData.transfers_24h, coin.transfers_24h)
      : '';
  const marketCapChange =
    prevData && coin.market_cap ? getChangeIndicator(prevData.market_cap, coin.market_cap) : '';

  // Chain display
  const chainDisplay = coin.chain || 'BSC';

  // Build response with markdown formatting
  let response =
    `🪙 *${coin.name}* (${coin.symbol}) on *${chainDisplay}*\n\n` +
    `💰 *Price:* ${formatPrice(coin.price)} ${priceChange}\n` +
    `💵 *Market Cap:* ${formatMarketCap(coin.market_cap)} ${marketCapChange}\n` +
    `👥 *Holders:* ${formatNumber(coin.holders)} ${holdersChange}\n` +
    `📊 *Transfers (24h):* ${formatNumber(coin.transfers_24h)} ${transfersChange}\n\n` +
    `📝 *Contract:* \`${coin.contract}\`\n` +
    `🔗 *View on Explorer:* ${getExplorerLink(coin.contract, coin.chain)}\n` +
    `🕒 *Last Updated:* ${formatTimestamp(coin.last_updated)}`;

  // Add activity ratio if we have both holders and transfers
  if (coin.holders && coin.transfers_24h) {
    const activityRatio = coin.transfers_24h / coin.holders;
    response += `\n\n📈 *Activity Ratio:* ${activityRatio.toFixed(4)} transfers per holder in 24h`;

    // Add simple analysis
    if (activityRatio > 0.5) {
      response += '\n⚠️ *High activity ratio* - Could indicate significant trading or distribution';
    } else if (activityRatio < 0.05) {
      response += '\n⚠️ *Low activity ratio* - May suggest low trading interest';
    }
  }

  return response;
}

function formatAlertMetricValue(metric, value) {
  switch (metric) {
    case 'price':
      return formatPrice(value);
    case 'market_cap':
      return formatMarketCap(value);
    case 'holders':
    case 'transfers_24h':
      return formatNumber(value);
    default:
      return value;
  }
}
