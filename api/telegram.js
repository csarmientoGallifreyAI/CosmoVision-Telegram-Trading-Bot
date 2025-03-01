const { Telegraf } = require('telegraf');
const Database = require('../src/database');
const Scraper = require('../src/scraper');
const Blockchain = require('../src/blockchain');
const Logger = require('../src/services/logger');
const AlertModel = require('../src/models/alertModel');
const { SimilarityEngine, TrendAnalyzer, NLPEngine, RiskAnalyzer } = require('../src/ai');
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
        `You can also set alerts with /setalert command or try our AI features with /discover.\n\n` +
        `Type /help to see all available commands.`
    );
  });

  bot.help((ctx) => {
    return ctx.reply(
      'Meme Coin Analysis Bot Commands:\n\n' +
        '📊 Basic Commands:\n' +
        '/analyze <coin_name> - Get analysis for a specific coin\n' +
        '/setalert <coin> <metric> <condition> <threshold> - Set an alert\n' +
        '/myalerts - View your active alerts\n' +
        '/removealert <number> - Remove an alert\n\n' +
        '🧠 AI-Powered Commands:\n' +
        '/discover <query> - Find coins matching specific criteria\n' +
        '/similar <coin> - Find coins similar to a specific one\n' +
        '/trend <coin> - Get AI-powered trend analysis\n' +
        '/risk <coin> - Get detailed risk assessment\n\n' +
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

  // Add AI-powered discovery
  bot.command('discover', async (ctx) => {
    const query = ctx.message.text.split(' ').slice(1).join(' ');

    if (!query || query.trim() === '') {
      return ctx.reply(
        "Please provide some details about what you're looking for.\n\n" +
          'Example queries:\n' +
          '- /discover coins with over 1000 holders\n' +
          '- /discover most active BSC coins\n' +
          '- /discover coins with low market cap\n'
      );
    }

    try {
      // Send typing indicator
      ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
      Logger.info(`User ${ctx.from.id} using discover: ${query}`);

      const results = await NLPEngine.processQuery(query);

      if (results.type === 'discovery' && results.coins.length > 0) {
        const reply = [
          `🔍 *Found ${results.matchCount} coins matching your criteria*\n`,
          `Here are the top ${results.coins.length} results:\n`,
        ];

        for (const [i, coin] of results.coins.entries()) {
          const risk = await RiskAnalyzer.calculateRiskScore(coin);
          reply.push(
            `${i + 1}. *${coin.name}* (${coin.symbol}) - ${coin.chain}\n` +
              `   💰 Price: ${formatPrice(coin.price)}\n` +
              `   👥 Holders: ${formatNumber(coin.holders)}\n` +
              `   ⚠️ Risk: ${risk.category} (${risk.score}/100)\n`
          );
        }

        reply.push(`\nUse /analyze <coin name> for detailed metrics on any of these coins.`);

        return ctx.reply(reply.join(''), { parse_mode: 'Markdown' });
      } else {
        return ctx.reply(
          "I couldn't find any coins matching those criteria. Try different search terms."
        );
      }
    } catch (error) {
      Logger.error('Error in discover command:', { error: error.message, query });
      return ctx.reply('Sorry, I encountered an error while processing your discovery request.');
    }
  });

  // Add similarity recommendation command
  bot.command('similar', async (ctx) => {
    const query = ctx.message.text.split(' ').slice(1).join(' ');

    if (!query) {
      return ctx.reply(
        'Please provide a coin name or symbol to find similar coins.\n\nExample: /similar DOGE'
      );
    }

    try {
      // Find the requested coin
      const coin = await Database.search_coin(query);

      if (!coin) {
        return ctx.reply(
          `Could not find a coin matching '${query}'. Try a different name or symbol.`
        );
      }

      // Send typing indicator while processing
      ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
      Logger.info(`User ${ctx.from.id} finding similar coins to: ${coin.name}`);

      // Find similar coins
      const similarCoins = await SimilarityEngine.findSimilarCoins(coin.contract);

      if (similarCoins.length === 0) {
        return ctx.reply(`I couldn't find any coins similar to ${coin.name} in my database.`);
      }

      // Format response
      const reply = [`🔍 *Coins similar to ${coin.name} (${coin.symbol})*\n\n`];

      for (const [i, similar] of similarCoins.entries()) {
        reply.push(
          `${i + 1}. *${similar.name}* (${similar.symbol})\n` +
            `   💰 Price: ${formatPrice(similar.price)}\n` +
            `   👥 Holders: ${formatNumber(similar.holders)}\n`
        );
      }

      reply.push(`\nUse /analyze <coin name> to get full details on any of these coins.`);

      return ctx.reply(reply.join(''), { parse_mode: 'Markdown' });
    } catch (error) {
      Logger.error('Error in similar command:', { error: error.message, query });
      return ctx.reply('Sorry, an error occurred while finding similar coins.');
    }
  });

  // Add AI trend analysis command
  bot.command('trend', async (ctx) => {
    const query = ctx.message.text.split(' ').slice(1).join(' ');

    if (!query) {
      return ctx.reply(
        'Please provide a coin name or symbol to analyze trends.\n\nExample: /trend DOGE'
      );
    }

    try {
      // Find the requested coin
      const coin = await Database.search_coin(query);

      if (!coin) {
        return ctx.reply(
          `Could not find a coin matching '${query}'. Try a different name or symbol.`
        );
      }

      // Send typing indicator
      ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
      Logger.info(`User ${ctx.from.id} requesting trend analysis for: ${coin.name}`);

      // Get trend analysis
      const trendData = await TrendAnalyzer.buildHolderGrowthModel(coin.contract);

      if (!trendData) {
        return ctx.reply(
          `Not enough historical data for ${coin.name} to perform trend analysis. Try again later.`
        );
      }

      // Format response
      const direction =
        trendData.trendDirection === 'up'
          ? '📈 Upward'
          : trendData.trendDirection === 'down'
          ? '📉 Downward'
          : '➡️ Stable';
      const emoji =
        trendData.trendDirection === 'up'
          ? '🟢'
          : trendData.trendDirection === 'down'
          ? '🔴'
          : '🟡';

      const reply = [
        `🔮 *Trend Analysis: ${coin.name} (${coin.symbol})*\n\n`,
        `${emoji} *Holder Trend:* ${direction}\n`,
        `⚖️ *Confidence:* ${trendData.confidence.toFixed(1)}%\n\n`,
        `*Projected Growth Rates:*\n`,
      ];

      for (let i = 0; i < trendData.growthRates.length; i++) {
        const day = i + 1;
        const rate = trendData.growthRates[i];
        const sign = rate >= 0 ? '+' : '';
        reply.push(`Day ${day}: ${sign}${rate.toFixed(2)}%\n`);
      }

      reply.push(
        `\n*Note:* This is an experimental prediction based on historical data and should not be considered financial advice.`
      );

      return ctx.reply(reply.join(''), { parse_mode: 'Markdown' });
    } catch (error) {
      Logger.error('Error in trend command:', { error: error.message, query });
      return ctx.reply('Sorry, an error occurred during trend analysis.');
    }
  });

  // Add risk assessment command
  bot.command('risk', async (ctx) => {
    const query = ctx.message.text.split(' ').slice(1).join(' ');

    if (!query) {
      return ctx.reply(
        'Please provide a coin name or symbol to assess risk.\n\nExample: /risk DOGE'
      );
    }

    try {
      // Find the requested coin
      const coin = await Database.search_coin(query);

      if (!coin) {
        return ctx.reply(
          `Could not find a coin matching '${query}'. Try a different name or symbol.`
        );
      }

      // Send typing indicator
      ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
      Logger.info(`User ${ctx.from.id} requesting risk assessment for: ${coin.name}`);

      // Calculate risk profile
      const risk = await RiskAnalyzer.calculateRiskScore(coin);

      // Generate risk visualization
      const riskBar = generateRiskBar(risk.score);

      // Format response
      const reply = [
        `⚠️ *Risk Assessment: ${coin.name} (${coin.symbol})*\n\n`,
        `*Overall Risk:* ${risk.category} (${risk.score}/100)\n`,
        `${riskBar}\n\n`,
        `*Risk Factors:*\n`,
        `👥 Holder Concentration: ${risk.factors.holderConcentration.toFixed(0)}/100\n`,
        `📊 Price Volatility: ${risk.factors.priceVolatility.toFixed(0)}/100\n`,
        `💧 Liquidity: ${risk.factors.liquidity.toFixed(0)}/100\n`,
        `🕒 Age Factor: ${risk.factors.age.toFixed(0)}/100\n`,
        `📈 Holder Stability: ${risk.factors.holderChange.toFixed(0)}/100\n\n`,
        `*Note:* Lower scores represent lower risk. This analysis is based on on-chain metrics and historical data patterns.`,
      ];

      return ctx.reply(reply.join(''), { parse_mode: 'Markdown' });
    } catch (error) {
      Logger.error('Error in risk command:', { error: error.message, query });
      return ctx.reply('Sorry, an error occurred during risk assessment.');
    }
  });

  // Natural language query handler
  bot.on('text', async (ctx) => {
    const text = ctx.message.text;

    // Skip if it's a command
    if (text.startsWith('/')) return;

    try {
      // Simple heuristic to check if user is asking about meme coins
      const relevantTerms = [
        'coin',
        'token',
        'crypto',
        'meme',
        'investment',
        'holder',
        'price',
        'market',
      ];
      const isRelevant = relevantTerms.some((term) => text.toLowerCase().includes(term));

      if (!isRelevant) return;

      // Log the query attempt
      Logger.info(`Received natural language query: ${text.substring(0, 100)}`);

      // Attempt to process as natural language query
      ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
      const results = await NLPEngine.processQuery(text);

      if (results.type !== 'unknown' && results.type !== 'error') {
        // Handle based on intent type
        switch (results.type) {
          case 'discovery':
            if (results.coins && results.coins.length > 0) {
              const reply = [
                `I found ${results.matchCount} coins matching your query. Here are the top results:\n\n`,
              ];

              for (const [i, coin] of results.coins.entries()) {
                if (i < 3) {
                  // Show top 3 for natural language queries
                  reply.push(
                    `${coin.name} (${coin.symbol}) - ${formatPrice(coin.price)}\n` +
                      `Holders: ${formatNumber(coin.holders)}\n\n`
                  );
                }
              }

              reply.push(`Use /discover for more advanced searching options.`);

              ctx.reply(reply.join(''));
            }
            break;

          case 'analysis':
            if (results.coin) {
              // Redirect to analyze command
              ctx.reply(
                `I found information about ${results.coin.name}. Use /analyze ${results.coin.symbol} for full details.`
              );
            }
            break;

          case 'comparison':
            if (results.coins && results.coins.length >= 2) {
              // Give a simple comparison
              const reply = [`Here's a quick comparison:\n\n`];

              for (const coin of results.coins) {
                reply.push(`${coin.name} (${coin.symbol}):\n`);
                reply.push(`Price: ${formatPrice(coin.price)}\n`);
                reply.push(`Holders: ${formatNumber(coin.holders)}\n\n`);
              }

              ctx.reply(reply.join(''));
            }
            break;
        }
      }
    } catch (error) {
      Logger.error('Error processing natural language query:', { error: error.message });
      // Don't reply on error for natural language to avoid spam
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

// Helper function to generate visual risk bar
function generateRiskBar(score) {
  const totalBlocks = 10;
  const filledBlocks = Math.round(score / 10);

  const colors = {
    low: '🟢',
    moderate: '🟡',
    high: '🟠',
    veryHigh: '🔴',
  };

  let bar = '';
  for (let i = 0; i < totalBlocks; i++) {
    if (i < filledBlocks) {
      if (i < 3) bar += colors.low;
      else if (i < 5) bar += colors.moderate;
      else if (i < 8) bar += colors.high;
      else bar += colors.veryHigh;
    } else {
      bar += '⚪';
    }
  }

  return bar;
}
