/**
 * Trading Dashboard API
 *
 * Provides data for the trading dashboard frontend
 */

const TradeModel = require('../../src/models/tradeModel');
const TradingService = require('../../src/services/trading');
const Database = require('../../src/database');
const Logger = require('../../src/services/logger');

// Ensure required tables exist
TradeModel.createTables().catch((error) => {
  Logger.error('Failed to initialize trade tables:', { error: error.message });
});

/**
 * API route for trading dashboard data
 */
export default async function handler(req, res) {
  try {
    // Check for authentication
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const user = validateToken(token);

    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get requested data based on endpoint
    const endpoint = req.query.endpoint || 'summary';
    let data;

    switch (endpoint) {
      case 'signals':
        data = await getSignals(req.query);
        break;
      case 'performance':
        data = await getPerformance(req.query);
        break;
      case 'trades':
        data = await getTrades(user.id, req.query);
        break;
      case 'sentiment':
        data = await getSentiment(req.query);
        break;
      case 'summary':
      default:
        data = await getSummary(user.id);
        break;
    }

    return res.status(200).json(data);
  } catch (error) {
    Logger.error('Error in trading dashboard API:', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Validate API token
 * @param {string} token - Authentication token
 * @returns {Object|null} - User object or null if invalid
 */
function validateToken(token) {
  try {
    // Simple validation for now - will be replaced with JWT validation
    if (token === process.env.API_SECRET_KEY) {
      return { id: 'system', role: 'admin' };
    }

    // Check if token exists in database
    if (!Database.db) {
      Database.initialize_database();
    }

    const stmt = Database.db.prepare('SELECT * FROM api_tokens WHERE token = ?');
    const result = stmt.get(token);

    if (result) {
      return { id: result.user_id, role: result.role };
    }

    return null;
  } catch (error) {
    Logger.error('Error validating token:', { error: error.message });
    return null;
  }
}

/**
 * Get trading signals
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} - Signals data
 */
async function getSignals(query = {}) {
  try {
    const chain = query.chain || 'all';
    const direction = query.direction || 'all';
    const limit = parseInt(query.limit || '10');

    const options = {};
    if (chain !== 'all') options.chain = chain;
    if (direction !== 'all') options.direction = direction;
    options.limit = limit;

    const signals = await TradeModel.getActiveSignals(options);

    return {
      timestamp: Date.now(),
      count: signals.length,
      signals,
    };
  } catch (error) {
    Logger.error('Error getting trading signals:', { error: error.message });
    return { error: 'Failed to retrieve signals', timestamp: Date.now() };
  }
}

/**
 * Get user's trade performance
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} - Performance data
 */
async function getPerformance(query = {}) {
  try {
    const period = query.period || 'all';
    const chain = query.chain || 'all';

    // Mock data for now
    return {
      timestamp: Date.now(),
      winRate: 0.65,
      totalTrades: 20,
      successfulTrades: 13,
      averageProfit: 12.5,
      bestTrade: {
        coin: 'DOGE',
        profit: 35.2,
        date: '2023-06-15',
      },
      worstTrade: {
        coin: 'SHIB',
        profit: -8.3,
        date: '2023-06-10',
      },
    };
  } catch (error) {
    Logger.error('Error getting performance data:', { error: error.message });
    return { error: 'Failed to retrieve performance data', timestamp: Date.now() };
  }
}

/**
 * Get user's trades
 * @param {string} userId - User ID
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} - Trades data
 */
async function getTrades(userId, query = {}) {
  try {
    const status = query.status || 'all';
    const limit = parseInt(query.limit || '20');

    const trades = await TradeModel.getUserTrades(userId, limit, status);

    return {
      timestamp: Date.now(),
      count: trades.length,
      trades,
    };
  } catch (error) {
    Logger.error('Error getting user trades:', { error: error.message, userId });
    return { error: 'Failed to retrieve trades', timestamp: Date.now() };
  }
}

/**
 * Get sentiment analysis for a coin
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} - Sentiment data
 */
async function getSentiment(query = {}) {
  try {
    const symbol = query.symbol;

    if (!symbol) {
      return { error: 'Symbol parameter is required', timestamp: Date.now() };
    }

    // Get coin from database
    if (!Database.db) {
      Database.initialize_database();
    }

    const stmt = Database.db.prepare('SELECT * FROM coins WHERE symbol = ? COLLATE NOCASE');
    const coin = stmt.get(symbol);

    if (!coin) {
      return { error: 'Coin not found', timestamp: Date.now() };
    }

    // Get sentiment analysis
    const sentiment = await TradingService.analyzeSentiment(coin, 'system');

    return {
      timestamp: Date.now(),
      coin: {
        name: coin.name,
        symbol: coin.symbol,
        price: coin.price,
      },
      sentiment,
    };
  } catch (error) {
    Logger.error('Error getting sentiment data:', { error: error.message });
    return { error: 'Failed to retrieve sentiment data', timestamp: Date.now() };
  }
}

/**
 * Get summary of all trading metrics
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Summary data
 */
async function getSummary(userId) {
  try {
    // Get active signals
    const signals = await TradeModel.getActiveSignals({ limit: 5 });

    // Get user's trades
    const trades = await TradeModel.getUserTrades(userId, 5);

    return {
      timestamp: Date.now(),
      activeSignalsCount: signals.length,
      activeSignals: signals,
      tradesCount: trades.length,
      recentTrades: trades,
      overallPerformance: {
        winRate: 0.65,
        totalTrades: 20,
        successfulTrades: 13,
        averageProfit: 12.5,
      },
    };
  } catch (error) {
    Logger.error('Error getting summary data:', { error: error.message, userId });
    return { error: 'Failed to retrieve summary data', timestamp: Date.now() };
  }
}
