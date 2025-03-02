/**
 * Trade Model
 *
 * Handles database operations for trade signals and user trades.
 */

const Database = require('../database');
const Logger = require('../services/logger');

class TradeModel {
  /**
   * Create necessary tables for trading functionality
   * @returns {Promise<boolean>} - Success status
   */
  static async createTables() {
    try {
      Logger.info('Creating or updating trade-related tables');

      if (!Database.db) {
        Database.initialize_database();
      }

      // Create trade signals table
      Database.db.exec(`
        CREATE TABLE IF NOT EXISTS trade_signals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contract TEXT NOT NULL,
          chain TEXT NOT NULL DEFAULT 'BSC',
          direction TEXT NOT NULL CHECK (direction IN ('buy', 'sell')),
          confidence REAL NOT NULL,
          sentiment_score REAL,
          potential_profit REAL,
          reason TEXT,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          FOREIGN KEY (contract) REFERENCES coins(contract),
          UNIQUE(contract, direction, created_at)
        );
        CREATE INDEX IF NOT EXISTS idx_signals_contract ON trade_signals(contract);
        CREATE INDEX IF NOT EXISTS idx_signals_status ON trade_signals(status);
        CREATE INDEX IF NOT EXISTS idx_signals_expires ON trade_signals(expires_at);
      `);

      // Create user trades table
      Database.db.exec(`
        CREATE TABLE IF NOT EXISTS user_trades (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          signal_id INTEGER,
          contract TEXT NOT NULL,
          direction TEXT NOT NULL CHECK (direction IN ('buy', 'sell')),
          amount REAL,
          price_at_trade REAL,
          created_at INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'open',
          closed_at INTEGER,
          profit_loss REAL,
          notes TEXT,
          FOREIGN KEY (contract) REFERENCES coins(contract),
          FOREIGN KEY (signal_id) REFERENCES trade_signals(id),
          FOREIGN KEY (user_id) REFERENCES users(user_id)
        );
        CREATE INDEX IF NOT EXISTS idx_trades_user ON user_trades(user_id);
        CREATE INDEX IF NOT EXISTS idx_trades_contract ON user_trades(contract);
        CREATE INDEX IF NOT EXISTS idx_trades_status ON user_trades(status);
      `);

      // Create performance metrics table
      Database.db.exec(`
        CREATE TABLE IF NOT EXISTS trade_performance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contract TEXT NOT NULL,
          period TEXT NOT NULL CHECK (period IN ('day', 'week', 'month')),
          direction TEXT NOT NULL CHECK (direction IN ('buy', 'sell')),
          signal_count INTEGER NOT NULL DEFAULT 0,
          successful_count INTEGER NOT NULL DEFAULT 0,
          average_profit REAL NOT NULL DEFAULT 0,
          last_updated INTEGER NOT NULL,
          FOREIGN KEY (contract) REFERENCES coins(contract),
          UNIQUE(contract, period, direction)
        );
        CREATE INDEX IF NOT EXISTS idx_performance_contract ON trade_performance(contract);
      `);

      Logger.info('Trade tables created or updated successfully');
      return true;
    } catch (error) {
      Logger.error('Error creating trade tables:', { error: error.message });
      return false;
    }
  }

  /**
   * Save a trade signal to the database
   * @param {Object} signal - Trade signal to save
   * @returns {Promise<number>} - ID of the saved signal
   */
  static async saveSignal(signal) {
    try {
      if (!Database.db) {
        Database.initialize_database();
      }

      const now = Math.floor(Date.now() / 1000);
      // Signals expire after 24 hours
      const expiresAt = now + 24 * 60 * 60;

      const stmt = Database.db.prepare(`
        INSERT INTO trade_signals (
          contract, chain, direction, confidence, sentiment_score,
          potential_profit, reason, created_at, expires_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        signal.coin.contract,
        signal.coin.chain || 'BSC',
        signal.type,
        signal.confidence,
        signal.sentiment,
        signal.potentialProfit,
        signal.reason,
        now,
        expiresAt,
        'active'
      );

      return result.lastInsertRowid;
    } catch (error) {
      Logger.error('Error saving trade signal:', { error: error.message });
      return null;
    }
  }

  /**
   * Get active trade signals
   * @param {Object} options - Query options
   * @param {string} options.chain - Filter by blockchain
   * @param {string} options.direction - Filter by direction ('buy' or 'sell')
   * @param {number} options.limit - Maximum number of signals to return
   * @returns {Promise<Array<Object>>} - List of active signals
   */
  static async getActiveSignals(options = {}) {
    try {
      if (!Database.db) {
        Database.initialize_database();
      }

      const now = Math.floor(Date.now() / 1000);
      const limit = options.limit || 10;

      // Build the query with optional filters
      let query = `
        SELECT s.*, c.name, c.symbol, c.price, c.holders, c.market_cap
        FROM trade_signals s
        JOIN coins c ON s.contract = c.contract
        WHERE s.status = 'active' AND s.expires_at > ?
      `;

      const params = [now];

      if (options.chain) {
        query += ` AND s.chain = ?`;
        params.push(options.chain);
      }

      if (options.direction) {
        query += ` AND s.direction = ?`;
        params.push(options.direction);
      }

      query += ` ORDER BY s.confidence DESC, s.potential_profit DESC LIMIT ?`;
      params.push(limit);

      const stmt = Database.db.prepare(query);
      return stmt.all(...params);
    } catch (error) {
      Logger.error('Error getting active signals:', { error: error.message });
      return [];
    }
  }

  /**
   * Record a user trade based on a signal
   * @param {string} userId - User ID
   * @param {number} signalId - Signal ID
   * @param {Object} tradeData - Trade data
   * @returns {Promise<number>} - ID of the recorded trade
   */
  static async recordTrade(userId, signalId, tradeData) {
    try {
      if (!Database.db) {
        Database.initialize_database();
      }

      const now = Math.floor(Date.now() / 1000);

      const stmt = Database.db.prepare(`
        INSERT INTO user_trades (
          user_id, signal_id, contract, direction, amount,
          price_at_trade, created_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        userId,
        signalId,
        tradeData.contract,
        tradeData.direction,
        tradeData.amount,
        tradeData.price,
        now,
        'open'
      );

      return result.lastInsertRowid;
    } catch (error) {
      Logger.error('Error recording user trade:', { error: error.message });
      return null;
    }
  }

  /**
   * Get a user's trade history
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of trades to return
   * @param {string} status - Filter by status ('open', 'closed', 'all')
   * @returns {Promise<Array<Object>>} - User's trade history
   */
  static async getUserTrades(userId, limit = 20, status = 'all') {
    try {
      if (!Database.db) {
        Database.initialize_database();
      }

      let query = `
        SELECT t.*, c.name, c.symbol, c.price as current_price
        FROM user_trades t
        JOIN coins c ON t.contract = c.contract
        WHERE t.user_id = ?
      `;

      const params = [userId];

      if (status !== 'all') {
        query += ` AND t.status = ?`;
        params.push(status);
      }

      query += ` ORDER BY t.created_at DESC LIMIT ?`;
      params.push(limit);

      const stmt = Database.db.prepare(query);
      return stmt.all(...params);
    } catch (error) {
      Logger.error('Error getting user trades:', { error: error.message, userId });
      return [];
    }
  }

  /**
   * Close a trade with profit/loss information
   * @param {number} tradeId - Trade ID
   * @param {string} userId - User ID
   * @param {Object} closeData - Data for closing the trade
   * @returns {Promise<boolean>} - Success status
   */
  static async closeTrade(tradeId, userId, closeData) {
    try {
      if (!Database.db) {
        Database.initialize_database();
      }

      const now = Math.floor(Date.now() / 1000);

      const stmt = Database.db.prepare(`
        UPDATE user_trades
        SET status = 'closed', closed_at = ?, profit_loss = ?, notes = ?
        WHERE id = ? AND user_id = ?
      `);

      const result = stmt.run(now, closeData.profitLoss, closeData.notes || '', tradeId, userId);

      return result.changes > 0;
    } catch (error) {
      Logger.error('Error closing trade:', { error: error.message, tradeId });
      return false;
    }
  }

  /**
   * Update trade performance metrics
   * @param {string} contract - Coin contract
   * @param {string} period - Period ('day', 'week', 'month')
   * @param {string} direction - Trade direction ('buy', 'sell')
   * @param {boolean} successful - Whether the trade was successful
   * @param {number} profit - Profit amount (positive or negative)
   * @returns {Promise<boolean>} - Success status
   */
  static async updatePerformanceMetrics(contract, period, direction, successful, profit) {
    try {
      if (!Database.db) {
        Database.initialize_database();
      }

      const now = Math.floor(Date.now() / 1000);

      // First try to get existing record
      const existingStmt = Database.db.prepare(`
        SELECT * FROM trade_performance
        WHERE contract = ? AND period = ? AND direction = ?
      `);

      const existing = existingStmt.get(contract, period, direction);

      if (existing) {
        // Update existing record
        const newSignalCount = existing.signal_count + 1;
        const newSuccessfulCount = successful
          ? existing.successful_count + 1
          : existing.successful_count;

        // Calculate new average profit
        const oldTotalProfit = existing.average_profit * existing.signal_count;
        const newTotalProfit = oldTotalProfit + profit;
        const newAverageProfit = newTotalProfit / newSignalCount;

        const updateStmt = Database.db.prepare(`
          UPDATE trade_performance
          SET signal_count = ?, successful_count = ?, average_profit = ?, last_updated = ?
          WHERE id = ?
        `);

        updateStmt.run(newSignalCount, newSuccessfulCount, newAverageProfit, now, existing.id);
      } else {
        // Insert new record
        const insertStmt = Database.db.prepare(`
          INSERT INTO trade_performance (
            contract, period, direction, signal_count, successful_count, average_profit, last_updated
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        insertStmt.run(contract, period, direction, 1, successful ? 1 : 0, profit, now);
      }

      return true;
    } catch (error) {
      Logger.error('Error updating performance metrics:', { error: error.message, contract });
      return false;
    }
  }

  /**
   * Get performance metrics for a coin
   * @param {string} contract - Coin contract
   * @returns {Promise<Object>} - Performance metrics
   */
  static async getPerformanceMetrics(contract) {
    try {
      if (!Database.db) {
        Database.initialize_database();
      }

      const stmt = Database.db.prepare(`
        SELECT * FROM trade_performance
        WHERE contract = ?
        ORDER BY period, direction
      `);

      return stmt.all(contract);
    } catch (error) {
      Logger.error('Error getting performance metrics:', { error: error.message, contract });
      return [];
    }
  }

  /**
   * Expire outdated signals
   * @returns {Promise<number>} - Number of expired signals
   */
  static async expireOldSignals() {
    try {
      if (!Database.db) {
        Database.initialize_database();
      }

      const now = Math.floor(Date.now() / 1000);

      const stmt = Database.db.prepare(`
        UPDATE trade_signals
        SET status = 'expired'
        WHERE status = 'active' AND expires_at < ?
      `);

      const result = stmt.run(now);

      if (result.changes > 0) {
        Logger.info(`Expired ${result.changes} outdated trading signals`);
      }

      return result.changes;
    } catch (error) {
      Logger.error('Error expiring old signals:', { error: error.message });
      return 0;
    }
  }

  /**
   * Update signal outcome with actual results
   * @param {number} signalId - Signal ID to update
   * @param {number} actualOutcome - Actual percentage change in price
   * @returns {Promise<boolean>} - Success status
   */
  static async updateSignalOutcome(signalId, actualOutcome) {
    try {
      if (!Database.db) {
        Database.initialize_database();
      }

      // First check if the signal exists and isn't already completed
      const checkStmt = Database.db.prepare(`
        SELECT * FROM trade_signals
        WHERE id = ? AND status IN ('active', 'expired')
      `);

      const signal = checkStmt.get(signalId);

      if (!signal) {
        Logger.warn(`Signal ${signalId} not found or already completed`);
        return false;
      }

      // Update with the actual outcome
      const updateStmt = Database.db.prepare(`
        UPDATE trade_signals
        SET actual_outcome = ?,
            status = 'completed'
        WHERE id = ?
      `);

      const result = updateStmt.run(actualOutcome, signalId);

      if (result.changes > 0) {
        Logger.info(`Updated signal ${signalId} with actual outcome: ${actualOutcome.toFixed(2)}%`);

        // Update performance metrics
        const successful =
          (signal.direction === 'buy' && actualOutcome > 0) ||
          (signal.direction === 'sell' && actualOutcome < 0);

        await this.updatePerformanceMetrics(
          signal.contract,
          'day',
          signal.direction,
          successful,
          actualOutcome
        );
      }

      return result.changes > 0;
    } catch (error) {
      Logger.error('Error updating signal outcome:', { error: error.message, signalId });
      return false;
    }
  }

  /**
   * Check and update outcomes for completed signals
   * @returns {Promise<number>} - Number of signals updated
   */
  static async checkAndUpdateSignalOutcomes() {
    try {
      if (!Database.db) {
        Database.initialize_database();
      }

      // Get expired signals that haven't been evaluated yet
      const stmt = Database.db.prepare(`
        SELECT s.*, c.price as current_price, c.name, c.symbol
        FROM trade_signals s
        JOIN coins c ON s.contract = c.contract
        WHERE s.status = 'expired' AND s.actual_outcome IS NULL
      `);

      const expiredSignals = stmt.all();

      if (expiredSignals.length === 0) {
        return 0;
      }

      Logger.info(`Checking outcomes for ${expiredSignals.length} expired signals`);

      let updatedCount = 0;

      for (const signal of expiredSignals) {
        try {
          // Calculate the actual outcome
          let actualOutcome = 0;

          // First try to get historical price data
          const historyData = await Database.getHistoricalMetrics(signal.contract, 'price', 7);

          // Find price at signal creation time
          const signalTime = signal.created_at;
          let priceAtSignal = 0;

          for (const entry of historyData) {
            // Find the closest price entry to signal creation time
            if (Math.abs(entry.timestamp - signalTime) < 86400) {
              // Within 24 hours
              priceAtSignal = entry.value;
              break;
            }
          }

          // If we couldn't find historical price, use the current price for a rough estimate
          if (priceAtSignal === 0) {
            priceAtSignal = signal.price_at_signal || signal.current_price;
          }

          // Calculate percentage change
          if (priceAtSignal > 0 && signal.current_price > 0) {
            actualOutcome = ((signal.current_price - priceAtSignal) / priceAtSignal) * 100;
          }

          // Update the signal outcome
          const updated = await this.updateSignalOutcome(signal.id, actualOutcome);

          if (updated) {
            updatedCount++;
            Logger.debug(
              `Signal ${signal.id} for ${signal.name}: outcome ${actualOutcome.toFixed(2)}%`
            );
          }
        } catch (signalError) {
          Logger.error(`Error processing outcome for signal ${signal.id}:`, {
            error: signalError.message,
            signal: signal.id,
          });
          // Continue with other signals
        }
      }

      return updatedCount;
    } catch (error) {
      Logger.error('Error checking signal outcomes:', { error: error.message });
      return 0;
    }
  }
}

module.exports = TradeModel;
