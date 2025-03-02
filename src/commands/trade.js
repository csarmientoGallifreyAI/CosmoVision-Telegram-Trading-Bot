/**
 * Trade Commands for Telegram Bot
 *
 * Provides commands for trading features, including viewing trading signals,
 * tracking trades, and managing trading preferences.
 */

const Context = require('../models/context');
const UserModel = require('../models/userModel');
const TradingService = require('../services/trading');
const MarketCapService = require('../services/marketCap');
const TradeModel = require('../models/tradeModel');
const DatabaseService = require('../database');
const Logger = require('../services/logger');

// Initialize the model when required
TradeModel.createTables().catch((error) => {
  Logger.error('Failed to initialize trade tables:', { error: error.message });
});

/**
 * Handles the /trade command, providing options for trading features
 * @param {Object} ctx - Telegram context
 */
async function handleTradeCommand(ctx) {
  try {
    const userId = ctx.from.id.toString();
    const user = await UserModel.findOrCreateUser(userId);

    if (!user) {
      return ctx.reply('Unable to process your request. Please try again later.', {
        parse_mode: 'HTML',
      });
    }

    // Create context to track conversation state
    const context = new Context(userId);
    context.set('command', 'trade');
    context.save();

    await ctx.reply(
      '<b>📈 Trading Dashboard</b>\n\n' +
        'Welcome to the CosmoVision trading features. What would you like to do?\n\n' +
        'Use these commands:\n' +
        '/signals - View current trading signals\n' +
        '/mytrades - View your trade history\n' +
        '/coins - View available coins for trading\n' +
        '/predict [symbol] - Get price prediction for a coin\n' +
        '/sentiment [symbol] - Get sentiment analysis for a coin',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📊 Trading Signals', callback_data: 'trades:signals' },
              { text: '📝 My Trades', callback_data: 'trades:mytrades' },
            ],
            [
              { text: '🪙 Available Coins', callback_data: 'trades:coins' },
              { text: '⚙️ Preferences', callback_data: 'trades:preferences' },
            ],
          ],
        },
      }
    );
  } catch (error) {
    Logger.error('Error in trade command:', { error: error.message });
    ctx.reply('Sorry, there was an error processing your request.');
  }
}

/**
 * Handles the /signals command, showing current trading signals
 * @param {Object} ctx - Telegram context
 */
async function handleSignalsCommand(ctx) {
  try {
    const userId = ctx.from.id.toString();
    await ctx.reply('🔍 Searching for trading signals... This may take a moment.');

    // Get active signals from database
    let signals = await TradeModel.getActiveSignals({ limit: 5 });

    // If no signals in DB, generate new ones
    if (!signals || signals.length === 0) {
      // Get top coins with sufficient market cap
      const coins = await MarketCapService.getTopCoins(15);
      if (!coins || coins.length === 0) {
        return ctx.reply('No coins available for analysis. Please try again later.');
      }

      // Generate signals
      const generatedSignals = await TradingService.generateTradingSignals(coins, userId);

      // Save signals to database
      if (generatedSignals && generatedSignals.length > 0) {
        for (const signal of generatedSignals) {
          await TradeModel.saveSignal(signal);
        }

        // Re-fetch from database to get IDs
        signals = await TradeModel.getActiveSignals({ limit: 5 });
      }
    }

    if (!signals || signals.length === 0) {
      return ctx.reply('No trading signals found at this time. Check back later!');
    }

    // Format signals for display
    let message = '<b>📊 Current Trading Signals</b>\n\n';

    for (const signal of signals) {
      const arrow = signal.direction === 'buy' ? '🟢 BUY' : '🔴 SELL';
      const confidence = Math.round(signal.confidence * 100);
      const profitDisplay = signal.potential_profit
        ? `Target: <b>$${signal.potential_profit.toFixed(2)}</b> per $100`
        : '';

      message += `${arrow} <b>${signal.symbol}</b> (${confidence}% confidence)\n`;
      message += `${signal.reason}\n`;
      if (profitDisplay) message += `${profitDisplay}\n`;

      // Add a button to view more or execute
      const tradeUrl = TradingService.generateTradeTransaction(
        {
          contract: signal.contract,
          chain: signal.chain,
          name: signal.name,
          symbol: signal.symbol,
        },
        signal.direction
      );

      if (tradeUrl) {
        message += `<a href="${tradeUrl.url}">Trade on ${tradeUrl.dex}</a>\n`;
      }

      message += `\n`;
    }

    message +=
      '⚠️ <i>Trading signals are for informational purposes only. Always do your own research before trading.</i>';

    // Add buttons for saving signals
    const inlineKeyboard = signals.map((signal) => [
      {
        text: `Save ${signal.symbol} ${signal.direction.toUpperCase()} signal`,
        callback_data: `trades:save:${signal.id}`,
      },
    ]);

    // Add refresh button
    inlineKeyboard.push([
      { text: '🔄 Refresh Signals', callback_data: 'trades:refreshsignals' },
      { text: '📊 View All', callback_data: 'trades:allsignals' },
    ]);

    await ctx.reply(message, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  } catch (error) {
    Logger.error('Error in signals command:', { error: error.message });
    ctx.reply('Sorry, there was an error retrieving trading signals.');
  }
}

/**
 * Handles the /mytrades command, showing user's trade history
 * @param {Object} ctx - Telegram context
 */
async function handleMyTradesCommand(ctx) {
  try {
    const userId = ctx.from.id.toString();
    const user = await UserModel.findOrCreateUser(userId);

    if (!user) {
      return ctx.reply('Unable to retrieve your trade history.');
    }

    // Get user's trades from database
    const trades = await TradeModel.getUserTrades(userId, 10);

    if (!trades || trades.length === 0) {
      return ctx.reply(
        "You haven't saved any trades yet. Use /signals to find trading opportunities.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📊 View Trading Signals', callback_data: 'trades:signals' }],
            ],
          },
        }
      );
    }

    // Format trades for display
    let message = '<b>📝 Your Trading History</b>\n\n';

    for (const trade of trades) {
      const direction = trade.direction === 'buy' ? '🟢 BUY' : '🔴 SELL';
      const status =
        trade.status === 'open'
          ? '⏳ OPEN'
          : trade.status === 'closed'
          ? '✅ CLOSED'
          : '⚠️ UNKNOWN';
      const date = new Date(trade.created_at * 1000).toLocaleDateString();

      // Calculate profit/loss for open trades
      let profitLoss = 'N/A';
      if (trade.status === 'open' && trade.price_at_trade && trade.current_price) {
        // Simple P/L calculation
        const change =
          trade.direction === 'buy'
            ? (trade.current_price - trade.price_at_trade) / trade.price_at_trade
            : (trade.price_at_trade - trade.current_price) / trade.price_at_trade;

        const absoluteChange = (change * trade.amount).toFixed(2);
        const percentChange = (change * 100).toFixed(1);

        const changeSymbol = change >= 0 ? '📈' : '📉';
        profitLoss = `${changeSymbol} ${
          change >= 0 ? '+' : ''
        }$${absoluteChange} (${percentChange}%)`;
      } else if (trade.status === 'closed' && trade.profit_loss !== null) {
        // Use recorded P/L for closed trades
        const changeSymbol = trade.profit_loss >= 0 ? '📈' : '📉';
        profitLoss = `${changeSymbol} ${
          trade.profit_loss >= 0 ? '+' : ''
        }$${trade.profit_loss.toFixed(2)}`;
      }

      message += `${direction} <b>${trade.symbol}</b> - ${status}\n`;
      message += `Date: ${date}\n`;
      message += `Amount: $${trade.amount ? trade.amount.toFixed(2) : 'N/A'}\n`;
      message += `P/L: ${profitLoss}\n\n`;
    }

    // Add buttons for managing trades
    const inlineKeyboard = [
      [
        { text: '📊 View Signals', callback_data: 'trades:signals' },
        { text: '🔄 Refresh Trades', callback_data: 'trades:refreshtrades' },
      ],
    ];

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  } catch (error) {
    Logger.error('Error in mytrades command:', { error: error.message });
    ctx.reply('Sorry, there was an error retrieving your trade history.');
  }
}

/**
 * Handles the /predict command, providing price prediction for a coin
 * @param {Object} ctx - Telegram context
 */
async function handlePredictCommand(ctx) {
  try {
    const userId = ctx.from.id.toString();

    // Get the symbol from the command arguments
    const text = ctx.message.text.trim();
    const args = text.split(' ');

    if (args.length < 2) {
      return ctx.reply('⚠️ Please specify a coin symbol.\n\nExample: <code>/predict DOGE</code>', {
        parse_mode: 'HTML',
      });
    }

    const symbol = args[1].toUpperCase();

    await ctx.reply(`🔮 Analyzing ${symbol} price trends... This may take a moment.`);

    // Find the coin in the database
    const coin = await findCoinBySymbol(symbol);

    if (!coin) {
      return ctx.reply(
        `Coin ${symbol} not found. Please check the symbol and try again.\n\nUse /coins to see available coins.`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: '🪙 View Available Coins', callback_data: 'trades:coins' }]],
          },
        }
      );
    }

    // Generate prediction
    const prediction = await TradingService.predictPriceMovement(coin, userId);

    // Format direction for display
    const directionText =
      prediction.direction === 'up'
        ? '📈 <b>BULLISH</b>'
        : prediction.direction === 'down'
        ? '📉 <b>BEARISH</b>'
        : '➡️ <b>NEUTRAL</b>';

    const confidence = Math.round(prediction.confidence * 100);

    // Calculate potential price change
    const expectedChange = prediction.expectedChange * 100;
    const expectedChangeText =
      expectedChange >= 0 ? `+${expectedChange.toFixed(1)}%` : `${expectedChange.toFixed(1)}%`;

    // Format the message
    let message = `<b>🔮 Price Prediction for ${symbol}</b>\n\n`;
    message += `Prediction: ${directionText}\n`;
    message += `Confidence: <b>${confidence}%</b>\n`;
    message += `Expected movement: <b>${expectedChangeText}</b>\n\n`;

    if (coin.price) {
      message += `Current price: <b>$${coin.price.toFixed(8)}</b>\n`;

      // Calculate potential future price
      const potentialPrice = coin.price * (1 + prediction.expectedChange);
      message += `Potential price: <b>$${potentialPrice.toFixed(8)}</b>\n\n`;
    }

    // Add time horizon
    message += `Time horizon: <b>24-48 hours</b>\n\n`;

    // Add source information
    message += `Analysis based on: ${
      prediction.source === 'analysis'
        ? 'Price trends, holder growth, and transfer activity'
        : 'Sentiment analysis and available metrics'
    }\n\n`;

    // Add disclaimer
    message +=
      '⚠️ <i>This prediction is for informational purposes only. Always do your own research before trading.</i>';

    // Add buttons for more actions
    const inlineKeyboard = [
      [
        { text: '📊 View Signals', callback_data: 'trades:signals' },
        { text: '📱 Sentiment Analysis', callback_data: `trades:sentiment:${symbol}` },
      ],
      [
        { text: '🔄 Refresh Prediction', callback_data: `trades:predict:${symbol}` },
        { text: '📈 View Chart', url: `https://dexscreener.com/search?q=${symbol}` },
      ],
    ];

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  } catch (error) {
    Logger.error('Error in predict command:', { error: error.message });
    ctx.reply('Sorry, there was an error generating the price prediction.');
  }
}

/**
 * Handles the /sentiment command, providing sentiment analysis for a coin
 * @param {Object} ctx - Telegram context
 */
async function handleSentimentCommand(ctx) {
  try {
    const userId = ctx.from.id.toString();

    // Get the symbol from the command arguments
    const text = ctx.message.text.trim();
    const args = text.split(' ');

    if (args.length < 2) {
      return ctx.reply(
        '⚠️ Please specify a coin symbol.\n\nExample: <code>/sentiment DOGE</code>',
        { parse_mode: 'HTML' }
      );
    }

    const symbol = args[1].toUpperCase();

    await ctx.reply(`📱 Analyzing social sentiment for ${symbol}... This may take a moment.`);

    // Find the coin in the database
    const coin = await findCoinBySymbol(symbol);

    if (!coin) {
      return ctx.reply(
        `Coin ${symbol} not found. Please check the symbol and try again.\n\nUse /coins to see available coins.`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: '🪙 View Available Coins', callback_data: 'trades:coins' }]],
          },
        }
      );
    }

    // Generate sentiment analysis
    const sentiment = await TradingService.analyzeSentiment(coin, userId);

    // Format sentiment for display
    const sentimentEmoji =
      sentiment.category === 'positive' ? '😀' : sentiment.category === 'negative' ? '😟' : '😐';

    const sentimentText =
      sentiment.category === 'positive'
        ? '<b>POSITIVE</b>'
        : sentiment.category === 'negative'
        ? '<b>NEGATIVE</b>'
        : '<b>NEUTRAL</b>';

    const sentimentScore = Math.round(sentiment.score * 100);

    // Build sentiment visualization
    const barLength = 10;
    const filledBars = Math.round(sentiment.score * barLength);
    const emptyBars = barLength - filledBars;
    const sentimentBar = '🟢'.repeat(filledBars) + '⚪'.repeat(emptyBars);

    // Format the message
    let message = `<b>📱 Social Sentiment for ${symbol}</b>\n\n`;
    message += `Overall sentiment: ${sentimentEmoji} ${sentimentText}\n`;
    message += `Sentiment score: <b>${sentimentScore}%</b>\n`;
    message += `${sentimentBar}\n\n`;

    // Add source information
    message += `Source: ${
      sentiment.source === 'ai'
        ? 'AI analysis of social media and news'
        : 'Default values (not enough data)'
    }\n\n`;

    // Add relevant trading insight based on sentiment
    if (sentiment.category === 'positive') {
      message +=
        '💡 <b>Insight:</b> Positive sentiment often precedes price increases. Consider watching for buy opportunities.\n\n';
    } else if (sentiment.category === 'negative') {
      message +=
        '💡 <b>Insight:</b> Negative sentiment may indicate upcoming price decreases. Be cautious with buy positions.\n\n';
    } else {
      message +=
        '💡 <b>Insight:</b> Neutral sentiment suggests sideways price action. Wait for stronger signals before trading.\n\n';
    }

    // Add disclaimer
    message +=
      '⚠️ <i>Sentiment analysis is for informational purposes only. Always do your own research before trading.</i>';

    // Add buttons for more actions
    const inlineKeyboard = [
      [
        { text: '🔮 Price Prediction', callback_data: `trades:predict:${symbol}` },
        { text: '📊 View Signals', callback_data: 'trades:signals' },
      ],
      [
        { text: '🔄 Refresh Sentiment', callback_data: `trades:sentiment:${symbol}` },
        { text: '🐦 View on Twitter', url: `https://twitter.com/search?q=%24${symbol}` },
      ],
    ];

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  } catch (error) {
    Logger.error('Error in sentiment command:', { error: error.message });
    ctx.reply('Sorry, there was an error generating the sentiment analysis.');
  }
}

/**
 * Handles the /coins command, showing available coins for trading
 * @param {Object} ctx - Telegram context
 */
async function handleCoinsCommand(ctx) {
  try {
    await ctx.reply('🔍 Fetching available coins... This may take a moment.');

    // Get top coins with market cap
    const coins = await MarketCapService.getTopCoins(20);

    if (!coins || coins.length === 0) {
      return ctx.reply('No coins available at the moment. Please try again later.');
    }

    // Format coins for display
    let message = '<b>🪙 Available Coins for Trading</b>\n\n';

    for (const coin of coins) {
      const marketCap = coin.market_cap ? `$${formatNumber(coin.market_cap)}` : 'Unknown';

      const price = coin.price ? `$${formatPrice(coin.price)}` : 'Unknown';

      message += `<b>${coin.symbol}</b> - ${coin.name}\n`;
      message += `Price: ${price}\n`;
      message += `Market Cap: ${marketCap}\n\n`;
    }

    // Add pagination buttons
    const inlineKeyboard = [
      [
        { text: '📊 View Signals', callback_data: 'trades:signals' },
        { text: '🔄 Refresh Coins', callback_data: 'trades:refreshcoins' },
      ],
    ];

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  } catch (error) {
    Logger.error('Error in coins command:', { error: error.message });
    ctx.reply('Sorry, there was an error retrieving available coins.');
  }
}

/**
 * Handle callback queries for trading features
 * @param {Object} ctx - Telegram context
 */
async function handleTradeCallback(ctx) {
  try {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id.toString();

    if (data === 'trades:signals') {
      // Show trading signals
      await handleSignalsCommand(ctx);
    } else if (data === 'trades:mytrades') {
      // Show user's trades
      await handleMyTradesCommand(ctx);
    } else if (data === 'trades:coins') {
      // Show available coins
      await handleCoinsCommand(ctx);
    } else if (data === 'trades:refreshsignals') {
      // Refresh signals (force generation of new signals)
      const coins = await MarketCapService.getTopCoins(15);
      const signals = await TradingService.generateTradingSignals(coins, userId);

      if (signals && signals.length > 0) {
        for (const signal of signals) {
          await TradeModel.saveSignal(signal);
        }
      }

      await handleSignalsCommand(ctx);
    } else if (data.startsWith('trades:save:')) {
      // Save a signal as a user trade
      const signalId = data.split(':')[2];

      // Get the signal from database
      const statement = DatabaseService.db.prepare(`
        SELECT * FROM trade_signals WHERE id = ?
      `);

      const signal = statement.get(signalId);

      if (!signal) {
        return ctx.answerCallbackQuery('Signal not found or expired.');
      }

      // Get the coin details
      const coinStatement = DatabaseService.db.prepare(`
        SELECT * FROM coins WHERE contract = ?
      `);

      const coin = coinStatement.get(signal.contract);

      if (!coin) {
        return ctx.answerCallbackQuery('Coin information not found.');
      }

      // Record the trade
      const tradeId = await TradeModel.recordTrade(userId, signalId, {
        contract: signal.contract,
        direction: signal.direction,
        amount: 100, // Default to $100
        price: coin.price || 0,
      });

      if (!tradeId) {
        return ctx.answerCallbackQuery('Failed to save trade. Please try again.');
      }

      await ctx.answerCallbackQuery('Trade saved to your portfolio!');
      await ctx.reply(
        `✅ ${signal.direction.toUpperCase()} signal for ${
          coin.symbol
        } saved to your portfolio.\n\n` + `Use /mytrades to view and manage your trades.`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: '📝 View My Trades', callback_data: 'trades:mytrades' }]],
          },
        }
      );
    } else if (data.startsWith('trades:predict:')) {
      // Show prediction for a specific coin
      const symbol = data.split(':')[2];

      // Simulate the predict command
      ctx.message = { text: `/predict ${symbol}` };
      await handlePredictCommand(ctx);
    } else if (data.startsWith('trades:sentiment:')) {
      // Show sentiment for a specific coin
      const symbol = data.split(':')[2];

      // Simulate the sentiment command
      ctx.message = { text: `/sentiment ${symbol}` };
      await handleSentimentCommand(ctx);
    } else if (data === 'trades:refreshtrades') {
      // Refresh user's trades
      await handleMyTradesCommand(ctx);
    } else if (data === 'trades:refreshcoins') {
      // Refresh available coins
      await handleCoinsCommand(ctx);
    } else if (data === 'trades:preferences') {
      // Show trading preferences
      await showTradingPreferences(ctx);
    }
  } catch (error) {
    Logger.error('Error in trade callback:', { error: error.message });
    ctx.answerCallbackQuery('Sorry, there was an error processing your request.');
  }
}

/**
 * Show trading preferences for the user
 * @param {Object} ctx - Telegram context
 */
async function showTradingPreferences(ctx) {
  try {
    const userId = ctx.from.id.toString();
    const user = await UserModel.findOrCreateUser(userId);

    if (!user) {
      return ctx.reply('Unable to retrieve your preferences.');
    }

    // Get user's preferences (mock data for now)
    const tradingEnabled = true;
    const preferredChains = ['BSC', 'ETH'];
    const notificationsEnabled = true;

    let message = '<b>⚙️ Trading Preferences</b>\n\n';
    message += `Trading features: <b>${tradingEnabled ? 'Enabled' : 'Disabled'}</b>\n`;
    message += `Preferred chains: <b>${preferredChains.join(', ')}</b>\n`;
    message += `Signal notifications: <b>${notificationsEnabled ? 'Enabled' : 'Disabled'}</b>\n\n`;
    message += 'Use the buttons below to update your preferences:';

    const inlineKeyboard = [
      [
        {
          text: `${tradingEnabled ? '🟢' : '🔴'} Trading Features`,
          callback_data: 'prefs:toggle:trading',
        },
        {
          text: `${notificationsEnabled ? '🟢' : '🔴'} Notifications`,
          callback_data: 'prefs:toggle:notifications',
        },
      ],
      [
        { text: 'BSC Chain', callback_data: 'prefs:chain:BSC' },
        { text: 'ETH Chain', callback_data: 'prefs:chain:ETH' },
        { text: 'Other Chains', callback_data: 'prefs:chain:other' },
      ],
      [{ text: '← Back to Trading', callback_data: 'trades:back' }],
    ];

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  } catch (error) {
    Logger.error('Error showing trading preferences:', { error: error.message });
    ctx.reply('Sorry, there was an error retrieving your preferences.');
  }
}

/**
 * Find a coin by symbol in the database
 * @param {string} symbol - Coin symbol
 * @returns {Promise<Object>} - Coin object
 */
async function findCoinBySymbol(symbol) {
  try {
    if (!DatabaseService.db) {
      DatabaseService.initialize_database();
    }

    const stmt = DatabaseService.db.prepare(`
      SELECT * FROM coins WHERE symbol = ? COLLATE NOCASE
    `);

    return stmt.get(symbol);
  } catch (error) {
    Logger.error('Error finding coin by symbol:', { error: error.message });
    return null;
  }
}

/**
 * Format number with commas for thousands
 * @param {number} num - Number to format
 * @returns {string} - Formatted number
 */
function formatNumber(num) {
  if (num === null || num === undefined) return 'Unknown';
  return num.toLocaleString('en-US');
}

/**
 * Format price with appropriate decimal places
 * @param {number} price - Price to format
 * @returns {string} - Formatted price
 */
function formatPrice(price) {
  if (price === null || price === undefined) return 'Unknown';

  // Format based on price magnitude
  if (price < 0.00001) return price.toExponential(4);
  if (price < 0.0001) return price.toFixed(8);
  if (price < 0.001) return price.toFixed(6);
  if (price < 0.01) return price.toFixed(5);
  if (price < 1) return price.toFixed(4);
  if (price < 1000) return price.toFixed(2);
  return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

module.exports = {
  handleTradeCommand,
  handleSignalsCommand,
  handleMyTradesCommand,
  handlePredictCommand,
  handleSentimentCommand,
  handleCoinsCommand,
  handleTradeCallback,
};
