/**
 * Trading Dashboard API
 *
 * Provides data for the trading dashboard frontend
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validateAPIKey } = require('../../src/services/auth');
const { TradeModel } = require('../../src/models/tradeModel');
const { TradingService } = require('../../src/services/trading');
const Database = require('../../src/database');
const Logger = require('../../src/services/logger');

// Ensure required tables exist
TradeModel.createTables().catch((error) => {
  Logger.error('Failed to initialize trade tables:', { error: error.message });
});

// In-memory store for one-time login codes
// In production, this should be in Redis or another distributed cache
const loginCodes = new Map();

function generateOneTimeLoginCode(userId) {
  // Generate a random 6-digit code
  const code = crypto.randomInt(100000, 999999).toString();

  // Store the code with expiration (5 minutes)
  loginCodes.set(code, {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes in milliseconds
  });

  return code;
}

function validateLoginCode(code) {
  const codeData = loginCodes.get(code);

  if (!codeData) {
    return null; // Code doesn't exist
  }

  if (Date.now() > codeData.expiresAt) {
    loginCodes.delete(code); // Clean up expired code
    return null; // Code expired
  }

  // Code is valid, delete it (one-time use)
  loginCodes.delete(code);

  return codeData.userId;
}

function generateJWT(userId, username) {
  // Sign JWT with a secret key (should be in environment variables in production)
  const token = jwt.sign(
    {
      userId,
      username,
    },
    process.env.JWT_SECRET || 'dashboard_jwt_secret',
    { expiresIn: '7d' } // Token expires in 7 days
  );

  return token;
}

function verifyJWT(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'dashboard_jwt_secret');
  } catch (error) {
    return null;
  }
}

module.exports = async (req, res) => {
  // Enable CORS for the dashboard domain
  res.setHeader('Access-Control-Allow-Origin', process.env.DASHBOARD_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Ensure API key is valid for non-auth endpoints
  if (req.url !== '/api/tradingDashboard/auth') {
    const apiKey = req.headers.authorization?.split(' ')[1];

    if (!apiKey) {
      return res.status(401).json({ error: 'Unauthorized: Missing API key' });
    }

    // Validate JWT for dashboard authentication
    const userData = verifyJWT(apiKey);
    if (!userData) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }

    // Store user data for route handlers
    req.user = userData;
  }

  // Route handling
  try {
    const path = req.url.replace('/api/tradingDashboard', '');

    // Authentication routes
    if (path === '/auth') {
      return handleAuth(req, res);
    }

    // Trading data routes
    if (path.startsWith('/signals')) {
      return handleSignals(req, res);
    }

    if (path.startsWith('/trades')) {
      return handleTrades(req, res);
    }

    if (path.startsWith('/performance')) {
      return handlePerformance(req, res);
    }

    if (path.startsWith('/settings')) {
      return handleSettings(req, res);
    }

    if (path.startsWith('/summary')) {
      return handleSummary(req, res);
    }

    // Default response for unmatched routes
    return res.status(404).json({ error: 'Endpoint not found' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Server error', message: error.message });
  }
};

// Auth handler for login and verification
async function handleAuth(req, res) {
  // Method must be POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, code, telegramId } = req.body;

  // Handle one-time code verification
  if (action === 'verify') {
    if (!code) {
      return res.status(400).json({ error: 'Missing verification code' });
    }

    const userId = validateLoginCode(code);

    if (!userId) {
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    try {
      // Fetch user details from database
      const userModel = require('../../src/models/userModel');
      const user = await userModel.getUserById(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Generate JWT token
      const token = generateJWT(user.id, user.username);

      return res.status(200).json({
        token,
        user: {
          id: user.id,
          username: user.username,
          telegram_id: user.telegram_id
        }
      });
    } catch (error) {
      console.error('Auth error:', error);
      return res.status(500).json({ error: 'Authentication error' });
    }
  }

  // Handle login code generation (for internal use by bot)
  if (action === 'generate' && req.headers['x-api-key'] === process.env.API_SECRET_KEY) {
    if (!telegramId) {
      return res.status(400).json({ error: 'Missing Telegram ID' });
    }

    try {
      // Fetch user details from database
      const userModel = require('../../src/models/userModel');
      const user = await userModel.getUserByTelegramId(telegramId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const code = generateOneTimeLoginCode(user.id);

      return res.status(200).json({ code });
    } catch (error) {
      console.error('Code generation error:', error);
      return res.status(500).json({ error: 'Failed to generate code' });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
}

// Handler for trading signals
async function handleSignals(req, res) {
  const { user } = req;

  try {
    const filters = req.query || {};

    // Get trading signals
    const tradeModel = new TradeModel();
    const signals = await tradeModel.getTradingSignals(filters);

    return res.status(200).json({ signals });
  } catch (error) {
    console.error('Signals error:', error);
    return res.status(500).json({ error: 'Failed to fetch signals' });
  }
}

// Handler for user trades
async function handleTrades(req, res) {
  const { user } = req;

  // Handle GET request to fetch trades
  if (req.method === 'GET') {
    try {
      const filters = req.query || {};

      const tradeModel = new TradeModel();
      const trades = await tradeModel.getUserTrades(user.userId, filters);

      return res.status(200).json({ trades });
    } catch (error) {
      console.error('Trades error:', error);
      return res.status(500).json({ error: 'Failed to fetch trades' });
    }
  }

  // Handle POST request to save a trade
  if (req.method === 'POST') {
    try {
      const { signalId, action } = req.body;

      if (!signalId || !action) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const tradeModel = new TradeModel();
      const tradingService = new TradingService();

      if (action === 'save') {
        // Save trade from signal
        const trade = await tradingService.saveTradeFromSignal(signalId, user.userId);
        return res.status(200).json({ trade });
      } else if (action === 'close') {
        // Close an existing trade
        const { tradeId, closePrice } = req.body;

        if (!tradeId) {
          return res.status(400).json({ error: 'Missing trade ID' });
        }

        const result = await tradeModel.closeTrade(tradeId, user.userId, closePrice);
        return res.status(200).json({ result });
      }

      return res.status(400).json({ error: 'Invalid action' });
    } catch (error) {
      console.error('Trade save error:', error);
      return res.status(500).json({ error: 'Failed to process trade' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Handler for performance metrics
async function handlePerformance(req, res) {
  const { user } = req;

  try {
    const timeframe = req.query.timeframe || '30d';

    const tradeModel = new TradeModel();
    const performance = await tradeModel.getPerformanceMetrics(user.userId, timeframe);

    return res.status(200).json(performance);
  } catch (error) {
    console.error('Performance error:', error);
    return res.status(500).json({ error: 'Failed to fetch performance data' });
  }
}

// Handler for user settings
async function handleSettings(req, res) {
  const { user } = req;

  // Handle GET request to fetch settings
  if (req.method === 'GET') {
    try {
      const userModel = require('../../src/models/userModel');
      const settings = await userModel.getUserSettings(user.userId);

      return res.status(200).json({ settings });
    } catch (error) {
      console.error('Settings error:', error);
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }
  }

  // Handle POST request to update settings
  if (req.method === 'POST') {
    try {
      const { settings } = req.body;

      if (!settings) {
        return res.status(400).json({ error: 'Missing settings data' });
      }

      const userModel = require('../../src/models/userModel');
      await userModel.updateUserSettings(user.userId, settings);

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Settings update error:', error);
      return res.status(500).json({ error: 'Failed to update settings' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Handler for dashboard summary data
async function handleSummary(req, res) {
  const { user } = req;

  try {
    const tradeModel = new TradeModel();

    // Get summary data in parallel
    const [activeSignals, userTrades, performance] = await Promise.all([
      tradeModel.getTradingSignals({ limit: 5 }),
      tradeModel.getUserTrades(user.userId, { limit: 5 }),
      tradeModel.getPerformanceMetrics(user.userId, '30d')
    ]);

    // Calculate summary stats
    const totalTrades = userTrades.length || 0;
    const winningTrades = userTrades.filter(t => t.profit_loss > 0).length || 0;
    const winRate = totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 100) : 0;

    // Calculate total profit/loss
    const totalProfitLoss = userTrades.reduce((sum, trade) => {
      return sum + (trade.profit_loss || 0);
    }, 0);

    return res.status(200).json({
      activeSignalsCount: activeSignals.length,
      totalTrades,
      winRate,
      totalProfitLoss,
      recentSignals: activeSignals.slice(0, 3),
      recentTrades: userTrades.slice(0, 3)
    });
  } catch (error) {
    console.error('Summary error:', error);
    return res.status(500).json({ error: 'Failed to fetch summary data' });
  }
}
