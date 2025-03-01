const { Telegraf } = require('telegraf');
const Database = require('../src/database');
const Scraper = require('../src/scraper');
const Blockchain = require('../src/blockchain');

// Initialize database
Database.initialize_database();

module.exports = async (req, res) => {
  console.log('Webhook received. Processing update...');

  // Verify method is POST
  if (req.method !== 'POST') {
    console.log(`Received ${req.method} request instead of POST`);
    return res.status(200).send('This endpoint accepts POST requests from Telegram only');
  }

  try {
    // Initialize bot instance
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // Log the update for debugging
    console.log('Update received:', JSON.stringify(req.body).substring(0, 200) + '...');

    // Register handlers (these run for each webhook request)
    registerBotHandlers(bot);

    // Process the update
    await bot.handleUpdate(req.body);

    // Return success
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);

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
        `Example: /analyze DOGE`
    );
  });

  bot.help((ctx) => {
    return ctx.reply(
      'Meme Coin Analysis Bot Commands:\n\n' +
        '/analyze <coin_name> - Get analysis for a specific coin\n' +
        '/help - Show this help message\n' +
        '/start - Start the bot'
    );
  });

  bot.command('analyze', async (ctx) => {
    const query = ctx.message.text.split(' ').slice(1).join(' ').trim();
    console.log(`User ${ctx.from.id} searching for coin: ${query}`);

    if (!query) {
      return ctx.reply('Please provide a coin name or symbol.\nExample: /analyze DOGE');
    }

    // Search for the coin
    try {
      const coin = await Database.search_coin(query);

      if (coin) {
        // Format response (similar to what was in telegram_bot.py)
        const response = formatCoinResponse(coin);
        return ctx.reply(response, { parse_mode: 'Markdown' });
      } else {
        return ctx.reply(
          `Could not find a coin matching '${query}'. Try a different name or symbol.`
        );
      }
    } catch (error) {
      console.error(`Error analyzing coin '${query}':`, error);
      return ctx.reply('Sorry, an error occurred while processing your request.');
    }
  });

  // Handle unexpected errors
  bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    ctx.reply('Sorry, an error occurred while processing your request.');
  });
}

function formatCoinResponse(coin) {
  // Format timestamp
  const formattedTimestamp = coin.last_updated
    ? new Date(coin.last_updated * 1000).toISOString().replace('T', ' ').substring(0, 19)
    : 'Never';

  // Format numbers with commas
  const formatNumber = (num) => {
    return num !== null && num !== undefined ? num.toLocaleString() : 'Unknown';
  };

  // Basic response
  let response =
    `🪙 *${coin.name}* (${coin.symbol})\n\n` +
    `💰 *Price:* $${coin.price.toFixed(8)}\n` +
    `👥 *Holders:* ${formatNumber(coin.holders)}\n` +
    `📊 *Transfers (24h):* ${formatNumber(coin.transfers_24h)}\n\n` +
    `📝 *Contract:* \`${coin.contract}\`\n` +
    `🕒 *Last Updated:* ${formattedTimestamp}`;

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
