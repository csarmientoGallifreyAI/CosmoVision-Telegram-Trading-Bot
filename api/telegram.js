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
const RateLimitService = require('../src/services/rateLimit');
const AIProviderManager = require('../src/services/aiProvider');
const fs = require('fs');
const path = require('path');

// Initialize database and alert table
Database.initialize_database();
AlertModel.createTable().catch((err) => {
  Logger.error('Failed to create alerts table:', { error: err.message });
});

// Bot configuration constants
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || '';
const BOT_PROFILE_PHOTO_PATH = path.join(process.cwd(), 'assets', 'bot-profile.jpg');

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

    // Check if the request is for initial setup (can be triggered by admin)
    const isSetupRequest = req.query && req.query.setup === 'true';
    if (isSetupRequest) {
      await setupBot(bot);
      return res.status(200).send('Bot setup completed');
    }

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

/**
 * Set up the bot's profile and initial configuration
 * This is meant to be run once during deployment or when configuration changes
 * @param {Telegraf} bot - The Telegraf bot instance
 */
async function setupBot(bot) {
  try {
    Logger.info('Setting up bot profile and configuration...');

    // Set bot commands
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Show help information' },
      { command: 'analyze', description: 'Analyze a specific coin' },
      { command: 'discover', description: 'Find coins matching specific criteria' },
      { command: 'similar', description: 'Find coins similar to a specific one' },
      { command: 'trend', description: 'Get AI-powered trend analysis' },
      { command: 'risk', description: 'Get risk assessment for a coin' },
      { command: 'setalert', description: 'Set price/metric alerts' },
      { command: 'myalerts', description: 'View your active alerts' },
      { command: 'share', description: 'Get your referral link to share with friends' },
      { command: 'referrals', description: 'View your referrals and points' },
      { command: 'usage', description: 'Check your API usage stats' },
      { command: 'trade', description: 'Access trading dashboard and features' },
      { command: 'signals', description: 'View current trading signals' },
      { command: 'mytrades', description: 'View your trade history' },
      { command: 'coins', description: 'View available coins for trading' },
      { command: 'predict', description: 'Get price prediction for a coin' },
      { command: 'sentiment', description: 'Get sentiment analysis for a coin' },
    ]);

    // Set bot profile photo if the file exists
    if (fs.existsSync(BOT_PROFILE_PHOTO_PATH)) {
      try {
        Logger.info('Setting bot profile photo...');
        // Read the profile photo file
        const photoBuffer = fs.readFileSync(BOT_PROFILE_PHOTO_PATH);
        // Upload the photo to Telegram
        await bot.telegram.setProfilePhoto(photoBuffer);
        Logger.info('Bot profile photo set successfully');
      } catch (photoError) {
        Logger.error('Error setting bot profile photo:', {
          error: photoError.message,
          path: BOT_PROFILE_PHOTO_PATH,
        });
        // Continue with setup even if profile photo fails
      }
    } else {
      Logger.info('No profile photo found. The bot will use default Telegram avatar.');
      // Continue with setup without setting profile photo
    }

    // Set bot description
    await bot.telegram.setMyDescription(
      'The ultimate AI-powered meme coin analytics bot. Track prices, holders, market caps, and receive personalized alerts. Discover new coins based on custom criteria and get AI-powered trend predictions.'
    );

    // Set bot short description (shown in chats)
    await bot.telegram.setMyShortDescription('AI-powered meme coin analytics and discovery');

    Logger.info('Bot setup completed successfully');
  } catch (error) {
    Logger.error('Error during bot setup:', { error: error.message });
    throw error;
  }
}

function registerBotHandlers(bot) {
  // User tracking middleware
  bot.use(async (ctx, next) => {
    if (ctx.from) {
      // Extract referral code from deep link if present
      let referralCode = null;

      if (ctx.message && ctx.message.text && ctx.message.text.startsWith('/start ')) {
        referralCode = ctx.message.text.split(' ')[1];
      }

      // Register/update user in database
      Database.registerUser(ctx.from, referralCode);
    }

    return next();
  });

  // Start command with referral handling
  bot.start((ctx) => {
    const startMessage = ctx.message.text;
    let referralCode = null;
    let welcomeMessage = `Hello ${ctx.from.first_name}! Welcome to the Meme Coin Analysis Bot.\n\n`;

    // Check if this contains a referral code
    if (startMessage.includes(' ')) {
      referralCode = startMessage.split(' ')[1];

      // Try to find referrer
      const referrer = Database.getUserByReferralCode(referralCode);
      if (referrer) {
        welcomeMessage += `You were invited by a friend! 👋\n\n`;
      }
    }

    welcomeMessage +=
      `Use /analyze <coin_name> or /analyze <symbol> to get metrics for a specific coin.\n\n` +
      `You can also set alerts with /setalert command or try our AI features with /discover.\n\n` +
      `Type /help to see all available commands.`;

    return ctx.reply(welcomeMessage);
  });

  // Enhanced help command
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
        '📈 Trading Features:\n' +
        '/trade - Open trading dashboard\n' +
        '/signals - View current trading signals\n' +
        '/mytrades - View your trade history\n' +
        '/predict <symbol> - Get price prediction for a coin\n' +
        '/sentiment <symbol> - Get sentiment analysis for a coin\n' +
        '/coins - View available coins for trading\n\n' +
        '👥 Community Features:\n' +
        '/share - Get your referral link to share with friends\n' +
        '/referrals - View your referrals and earned points\n' +
        '/usage - Check your API usage stats\n\n' +
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
    try {
      // Extract the query from the message
      const query = ctx.message.text.replace('/discover', '').trim();

      if (!query) {
        await ctx.reply(
          'Please provide search criteria. For example:\n/discover coins with over 1000 holders on BSC'
        );
        return;
      }

      const userId = ctx.message.from.id.toString();

      // Check rate limits before proceeding
      if (!RateLimitService.canMakeRequest(userId, 'nlp')) {
        await ctx.reply(
          'You have reached your daily limit for discover commands. Try again tomorrow.'
        );
        return;
      }

      await ctx.reply('Searching for coins matching your criteria...');

      // Process the query to extract intent and entities
      const processed = await NLPEngine.processQuery(query, userId);

      if (processed.type !== 'discovery') {
        await ctx.reply(
          "I couldn't understand your search criteria. Please try rephrasing your query or use simpler terms."
        );
        return;
      }

      // Handle the discovery intent
      const results = await NLPEngine.handleDiscoveryQuery(query, processed);

      if (!results.coins || results.coins.length === 0) {
        await ctx.reply('No coins found matching your criteria.');
        return;
      }

      // Format the results
      let message = `Found ${results.matchCount} coins matching your criteria. Here are the top results:\n\n`;

      for (const coin of results.coins) {
        // Get risk score for each coin
        const riskScore = await RiskAnalyzer.calculateRiskScore(coin);

        message += `${coin.name} (${coin.symbol})\n`;
        message += `Price: $${formatNumber(coin.price)}\n`;
        message += `Holders: ${formatNumber(coin.holders)}\n`;
        message += `Market Cap: $${formatNumber(coin.market_cap)}\n`;
        message += `Risk: ${riskScore.riskLevel}\n\n`;
      }

      await ctx.reply(message);
    } catch (error) {
      Logger.error('Error handling discover command:', { error: error.message });
      await ctx.reply('Sorry, there was an error processing your search.');
    }
  });

  // Add similarity recommendation command
  bot.command('similar', async (ctx) => {
    try {
      // Extract the coin name from the message
      const coinName = ctx.message.text.replace('/similar', '').trim();

      if (!coinName) {
        await ctx.reply('Please provide a coin name or symbol. For example:\n/similar PEPE');
        return;
      }

      const userId = ctx.message.from.id.toString();

      // Check rate limits before proceeding
      if (!RateLimitService.canMakeRequest(userId, 'similarity')) {
        await ctx.reply(
          'You have reached your daily limit for similarity commands. Try again tomorrow.'
        );
        return;
      }

      await ctx.reply(`Searching for coins similar to ${coinName}...`);

      // Search for the coin in the database
      const searchResults = await Database.search_coins(coinName);

      if (!searchResults || searchResults.length === 0) {
        await ctx.reply(`No coins found matching "${coinName}".`);
        return;
      }

      const coin = searchResults[0]; // Use the first match

      // Find similar coins
      const similarCoins = await SimilarityEngine.findSimilarCoins(coin.contract, 5, userId);

      if (!similarCoins || similarCoins.length === 0) {
        await ctx.reply(`No similar coins found for ${coin.name}.`);
        return;
      }

      // Format the results
      let message = `Coins similar to ${coin.name} (${coin.symbol}):\n\n`;

      for (const similar of similarCoins) {
        message += `${similar.name} (${similar.symbol})\n`;
        message += `Price: $${formatNumber(similar.price)}\n`;
        message += `Holders: ${formatNumber(similar.holders)}\n`;
        message += `Market Cap: $${formatNumber(similar.market_cap)}\n\n`;
      }

      await ctx.reply(message);
    } catch (error) {
      Logger.error('Error handling similar command:', { error: error.message });
      await ctx.reply('Sorry, there was an error finding similar coins.');
    }
  });

  // Add AI trend analysis command
  bot.command('trend', async (ctx) => {
    try {
      // Extract the coin name from the message
      const coinName = ctx.message.text.replace('/trend', '').trim();

      if (!coinName) {
        await ctx.reply('Please provide a coin name or symbol. For example:\n/trend PEPE');
        return;
      }

      const userId = ctx.message.from.id.toString();

      // Check rate limits before proceeding
      if (!RateLimitService.canMakeRequest(userId, 'trend')) {
        await ctx.reply(
          'You have reached your daily limit for trend commands. Try again tomorrow.'
        );
        return;
      }

      await ctx.reply(`Analyzing trends for ${coinName}...`);

      // Search for the coin in the database
      const searchResults = await Database.search_coins(coinName);

      if (!searchResults || searchResults.length === 0) {
        await ctx.reply(`No coins found matching "${coinName}".`);
        return;
      }

      const coin = searchResults[0]; // Use the first match

      // Get trend analysis
      const trendData = await TrendAnalyzer.analyzeTrend(coin.contract);

      if (!trendData) {
        await ctx.reply(`Not enough historical data to analyze trends for ${coin.name}.`);
        return;
      }

      // Format the results
      let message = `Trend Analysis for ${coin.name} (${coin.symbol}):\n\n`;

      message += `Price Trend: ${trendData.priceTrend.direction}\n`;
      message += `Projected Growth: ${trendData.priceTrend.projectedGrowth}%\n`;
      message += `Confidence: ${trendData.priceTrend.confidence}%\n\n`;

      message += `Holder Trend: ${trendData.holderTrend.direction}\n`;
      message += `Projected Growth: ${trendData.holderTrend.projectedGrowth}%\n`;
      message += `Confidence: ${trendData.holderTrend.confidence}%\n\n`;

      message += `Overall Outlook: ${trendData.outlook}\n`;

      await ctx.reply(message);

      // Track this request for rate limiting
      RateLimitService.incrementRequestCount(userId, 'trend');
    } catch (error) {
      Logger.error('Error handling trend command:', { error: error.message });
      await ctx.reply('Sorry, there was an error analyzing trends.');
    }
  });

  // Add risk assessment command
  bot.command('risk', async (ctx) => {
    try {
      // Extract the coin name from the message
      const coinName = ctx.message.text.replace('/risk', '').trim();

      if (!coinName) {
        await ctx.reply('Please provide a coin name or symbol. For example:\n/risk PEPE');
        return;
      }

      const userId = ctx.message.from.id.toString();

      // Check rate limits before proceeding
      if (!RateLimitService.canMakeRequest(userId, 'risk')) {
        await ctx.reply('You have reached your daily limit for risk commands. Try again tomorrow.');
        return;
      }

      await ctx.reply(`Assessing risk for ${coinName}...`);

      // Search for the coin in the database
      const searchResults = await Database.search_coins(coinName);

      if (!searchResults || searchResults.length === 0) {
        await ctx.reply(`No coins found matching "${coinName}".`);
        return;
      }

      const coin = searchResults[0]; // Use the first match

      // Get risk assessment
      const riskScore = await RiskAnalyzer.calculateRiskScore(coin);

      // Format the results
      let message = `Risk Assessment for ${coin.name} (${coin.symbol}):\n\n`;

      message += `Overall Risk: ${riskScore.riskLevel}\n`;
      message += `Risk Score: ${riskScore.score.toFixed(2)}/10\n\n`;

      message += `Risk Factors:\n`;
      message += `- Liquidity Risk: ${riskScore.factors.liquidity.toFixed(2)}/10\n`;
      message += `- Volatility Risk: ${riskScore.factors.volatility.toFixed(2)}/10\n`;
      message += `- Holder Risk: ${riskScore.factors.holders.toFixed(2)}/10\n`;
      message += `- Age Risk: ${riskScore.factors.age.toFixed(2)}/10\n`;
      message += `- Holder Change Risk: ${riskScore.factors.holderChange.toFixed(2)}/10\n\n`;

      message += `Remember: Always do your own research before investing.`;

      await ctx.reply(message);

      // Track this request for rate limiting
      RateLimitService.incrementRequestCount(userId, 'risk');
    } catch (error) {
      Logger.error('Error handling risk command:', { error: error.message });
      await ctx.reply('Sorry, there was an error assessing risk.');
    }
  });

  // Share command - generates referral link
  bot.command('share', async (ctx) => {
    // Get or register the user
    const user = Database.getUser(ctx.from.id) || Database.registerUser(ctx.from);

    if (!user || !user.referral_code) {
      return ctx.reply('❌ Error generating your referral link. Please try again later.');
    }

    const referralLink = `https://t.me/${BOT_USERNAME}?start=${user.referral_code}`;

    const shareMessage =
      `🔗 *Share this bot with friends!*\n\n` +
      `Use your personal referral link to invite friends to use this meme coin analytics bot. You'll earn points for each friend who joins!\n\n` +
      `Your referral link:\n` +
      `${referralLink}\n\n` +
      `*Current points:* ${user.points || 0}\n` +
      `Use /referrals to see details of your referrals.`;

    // Create an inline keyboard for easy sharing
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: '📱 Share on Telegram',
            url: `https://t.me/share/url?url=${encodeURIComponent(
              referralLink
            )}&text=${encodeURIComponent('Check out this awesome meme coin analytics bot!')}`,
          },
        ],
        [
          {
            text: '📋 Copy Link',
            callback_data: 'copy_link',
          },
        ],
      ],
    };

    return ctx.reply(shareMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  });

  // Handle the "Copy Link" button
  bot.action('copy_link', async (ctx) => {
    const user = Database.getUser(ctx.from.id);
    if (!user || !user.referral_code) {
      return ctx.answerCbQuery('Error retrieving your referral link.');
    }

    const referralLink = `https://t.me/${BOT_USERNAME}?start=${user.referral_code}`;

    // Let the user know we're "copying" (they actually need to copy it manually)
    await ctx.answerCbQuery('Copy this link to share with friends!');

    // Send the link as plain text so it's easy to copy
    return ctx.reply(`Here's your referral link:\n\n${referralLink}`);
  });

  // Referrals command - show referral stats
  bot.command('referrals', async (ctx) => {
    const user = Database.getUser(ctx.from.id);

    if (!user) {
      return ctx.reply(
        'You need to start using the bot before checking referrals. Use /start to begin.'
      );
    }

    const referrals = Database.getUserReferrals(ctx.from.id);
    const totalPoints = user.points || 0;

    let message = `📊 *Your Referral Stats*\n\n`;
    message += `Points: ${totalPoints}\n`;
    message += `Total Referrals: ${referrals.length}\n\n`;

    if (referrals.length > 0) {
      message += `*Your Referrals:*\n`;
      referrals.slice(0, 10).forEach((ref, index) => {
        const name = ref.username || ref.first_name || 'Anonymous';
        const date = new Date(ref.date * 1000).toLocaleDateString();
        message += `${index + 1}. ${name} - Joined: ${date}\n`;
      });

      if (referrals.length > 10) {
        message += `\n...and ${referrals.length - 10} more`;
      }
    } else {
      message += `You haven't referred anyone yet. Use /share to get your referral link!`;
    }

    message += `\n\n💡 *Earn points by inviting friends!*`;

    return ctx.reply(message, { parse_mode: 'Markdown' });
  });

  // Usage command - show API usage stats
  bot.command('usage', async (ctx) => {
    const stats = RateLimitService.getUserStats(ctx.from.id.toString());

    let message = `📊 *Your API Usage Stats*\n\n`;

    Object.entries(stats).forEach(([apiType, data]) => {
      const prettyName = apiType.charAt(0).toUpperCase() + apiType.slice(1);
      message += `${prettyName}: ${data.count}/${data.limit} (${data.remaining} remaining)\n`;
    });

    message += `\n*Usage resets daily*`;

    // Check if user is exempt from limits
    if (RateLimitService.isExemptUser(ctx.from.id.toString())) {
      message += `\n\n✨ You have unlimited access`;
    }

    return ctx.reply(message, { parse_mode: 'Markdown' });
  });

  // Admin-only command to check AI provider status
  bot.command('aistatus', async (ctx) => {
    // Check if user is admin
    if (!RateLimitService.isExemptUser(ctx.from.id.toString())) {
      return ctx.reply('This command is only available to administrators.');
    }

    const status = AIProviderManager.getStatus();

    let message = `🤖 *AI Provider Status*\n\n`;

    Object.entries(status).forEach(([provider, data]) => {
      message += `*${provider}*\n`;
      message += `Available: ${data.available ? '✅' : '❌'}\n`;
      message += `Error Count: ${data.errorCount}\n`;

      if (data.lastError) {
        message += `Last Error: ${data.lastError.substring(0, 50)}${
          data.lastError.length > 50 ? '...' : ''
        }\n`;

        const lastErrorTime = new Date(data.lastErrorTime).toLocaleString();
        message += `Last Error Time: ${lastErrorTime}\n`;
      }

      message += `\n`;
    });

    return ctx.reply(message, { parse_mode: 'Markdown' });
  });

  // Natural language query handler
  bot.on('text', async (ctx) => {
    try {
      // Ignore commands
      if (ctx.message.text.startsWith('/')) {
        return;
      }

      const text = ctx.message.text.trim();
      const userId = ctx.message.from.id.toString();

      // Check rate limits before proceeding
      if (!RateLimitService.canMakeRequest(userId, 'nlp')) {
        await ctx.reply(
          'You have reached your daily limit for AI queries. Try again tomorrow or use basic commands.'
        );
        return;
      }

      // Process the natural language query
      const processed = await NLPEngine.processQuery(text, userId);

      // Log whether we're using fallback or not
      if (processed.is_fallback) {
        Logger.info('Using fallback NLP processing for query', {
          query: text.substring(0, 50),
          intent: processed.type,
        });
      }

      // Handle different intent types
      switch (processed.type) {
        case 'discovery':
          // Process discovery intent
          const results = await NLPEngine.handleDiscoveryQuery(text, processed);

          if (!results.coins || results.coins.length === 0) {
            await ctx.reply('No coins found matching your criteria.');
            return;
          }

          // Format the results
          let message = `Found ${results.matchCount} coins matching your criteria. Here are the top results:\n\n`;

          for (const coin of results.coins) {
            message += `${coin.name} (${coin.symbol})\n`;
            message += `Price: $${formatNumber(coin.price)}\n`;
            message += `Holders: ${formatNumber(coin.holders)}\n`;
            message += `Market Cap: $${formatNumber(coin.market_cap)}\n\n`;
          }

          await ctx.reply(message);
          break;

        case 'analysis':
          // Extract coin name if available
          if (!processed.coin_name) {
            await ctx.reply('Please specify which coin you want to analyze.');
            return;
          }

          // Search for the coin
          const searchResults = await Database.search_coins(processed.coin_name);

          if (!searchResults || searchResults.length === 0) {
            await ctx.reply(`No coins found matching "${processed.coin_name}".`);
            return;
          }

          const coin = searchResults[0];

          // Format basic coin info
          let coinInfo = `${coin.name} (${coin.symbol}):\n\n`;
          coinInfo += `Price: $${formatNumber(coin.price)}\n`;
          coinInfo += `Holders: ${formatNumber(coin.holders)}\n`;
          coinInfo += `Market Cap: $${formatNumber(coin.market_cap)}\n`;
          coinInfo += `24h Transfers: ${formatNumber(coin.transfers_24h)}\n\n`;

          // Add risk assessment
          const riskScore = await RiskAnalyzer.calculateRiskScore(coin);
          coinInfo += `Risk Level: ${riskScore.riskLevel}\n`;

          await ctx.reply(coinInfo);
          break;

        case 'comparison':
          await ctx.reply('Coin comparison is coming soon!');
          break;

        default:
          // If we couldn't determine intent, give a generic response
          await ctx.reply(
            "I'm not sure what you're asking. Try using specific commands like /discover, /similar, /trend, or /risk."
          );
      }

      // Track this request for rate limiting
      RateLimitService.incrementRequestCount(userId, 'nlp');
    } catch (error) {
      Logger.error('Error handling text message:', { error: error.message });
      await ctx.reply('Sorry, I encountered an error processing your message.');
    }
  });

  // Import the trading command handlers
  const TradeCommands = require('../src/commands/trade');

  // Register trading commands
  bot.command('trade', TradeCommands.handleTradeCommand);
  bot.command('signals', TradeCommands.handleSignalsCommand);
  bot.command('mytrades', TradeCommands.handleMyTradesCommand);
  bot.command('predict', TradeCommands.handlePredictCommand);
  bot.command('sentiment', TradeCommands.handleSentimentCommand);
  bot.command('coins', TradeCommands.handleCoinsCommand);

  // Register callback handler for trading features
  bot.action(/^trades:/, TradeCommands.handleTradeCallback);

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
