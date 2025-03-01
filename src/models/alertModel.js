/**
 * Alert Model for managing user alerts
 * Handles alert creation, evaluation, and triggering
 */
const Database = require('../database');
const Logger = require('../services/logger');

class AlertModel {
  /**
   * Initialize the alerts table in the database
   */
  static async createTable() {
    try {
      if (!Database.db) {
        Database.initialize_database();
      }

      Logger.info('Creating alerts table if it does not exist');

      Database.db.exec(`
        CREATE TABLE IF NOT EXISTS alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          coin_contract TEXT NOT NULL,
          metric TEXT NOT NULL,
          condition TEXT NOT NULL,
          threshold REAL NOT NULL,
          created_at INTEGER NOT NULL,
          last_checked INTEGER DEFAULT NULL,
          last_triggered INTEGER DEFAULT NULL,
          FOREIGN KEY (coin_contract) REFERENCES coins(contract)
        );
        CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
        CREATE INDEX IF NOT EXISTS idx_alerts_contract ON alerts(coin_contract);
      `);

      return true;
    } catch (error) {
      Logger.error('Error creating alerts table', { error: error.message });
      throw error;
    }
  }

  /**
   * Create a new alert for a user
   * @param {number} userId - Telegram user ID
   * @param {string} contract - Coin contract address
   * @param {string} metric - Metric to monitor (price, holders, etc.)
   * @param {string} condition - Comparison condition (gt, lt, etc.)
   * @param {number} threshold - Threshold value for the alert
   * @returns {Promise<Object>} Created alert object
   */
  static async createAlert(userId, contract, metric, condition, threshold) {
    try {
      if (!Database.db) {
        Database.initialize_database();
      }

      // Validate inputs
      if (!userId || !contract || !metric || !condition || threshold === undefined) {
        throw new Error('Missing required fields for alert creation');
      }

      // Validate metric
      const validMetrics = ['price', 'holders', 'transfers_24h', 'market_cap'];
      if (!validMetrics.includes(metric)) {
        throw new Error(`Invalid metric. Choose from: ${validMetrics.join(', ')}`);
      }

      // Validate condition
      const validConditions = ['gt', 'lt', 'eq', 'gte', 'lte'];
      if (!validConditions.includes(condition)) {
        throw new Error(`Invalid condition. Choose from: ${validConditions.join(', ')}`);
      }

      // Check if coin exists in database
      const coin = Database.db.prepare('SELECT * FROM coins WHERE contract = ?').get(contract);
      if (!coin) {
        throw new Error(`Coin with contract ${contract} not found in database`);
      }

      // Insert the alert
      const stmt = Database.db.prepare(`
        INSERT INTO alerts (
          user_id, coin_contract, metric, condition, threshold, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const nowTimestamp = Math.floor(Date.now() / 1000);
      const result = stmt.run(userId, contract, metric, condition, threshold, nowTimestamp);

      // Get the inserted alert
      const alert = Database.db
        .prepare('SELECT * FROM alerts WHERE id = ?')
        .get(result.lastInsertRowid);

      Logger.info(
        `Created alert for user ${userId} on ${coin.name} ${metric} ${condition} ${threshold}`
      );

      return alert;
    } catch (error) {
      Logger.error('Error creating alert', {
        userId,
        contract,
        metric,
        condition,
        threshold,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get alerts for a specific user
   * @param {number} userId - Telegram user ID
   * @returns {Promise<Array>} Array of user's alerts
   */
  static async getUserAlerts(userId) {
    try {
      if (!Database.db) {
        Database.initialize_database();
      }

      const alerts = Database.db
        .prepare(
          `
        SELECT a.*, c.name, c.symbol, c.price, c.holders, c.transfers_24h, c.market_cap, c.chain
        FROM alerts a
        JOIN coins c ON a.coin_contract = c.contract
        WHERE a.user_id = ?
        ORDER BY a.created_at DESC
      `
        )
        .all(userId);

      return alerts;
    } catch (error) {
      Logger.error('Error getting user alerts', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Remove a specific alert
   * @param {number} alertId - Alert ID to remove
   * @param {number} userId - User ID (for verification)
   * @returns {Promise<boolean>} True if alert was removed
   */
  static async removeAlert(alertId, userId) {
    try {
      if (!Database.db) {
        Database.initialize_database();
      }

      // Verify the alert belongs to the user
      const alert = Database.db
        .prepare('SELECT * FROM alerts WHERE id = ? AND user_id = ?')
        .get(alertId, userId);

      if (!alert) {
        throw new Error('Alert not found or does not belong to user');
      }

      // Delete the alert
      const result = Database.db.prepare('DELETE FROM alerts WHERE id = ?').run(alertId);

      Logger.info(`Removed alert ${alertId} for user ${userId}`);

      return result.changes > 0;
    } catch (error) {
      Logger.error('Error removing alert', { alertId, userId, error: error.message });
      throw error;
    }
  }

  /**
   * Check all alerts and find triggered ones
   * @returns {Promise<Array>} Array of triggered alerts
   */
  static async checkAlerts() {
    try {
      if (!Database.db) {
        Database.initialize_database();
      }

      Logger.info('Checking alerts for triggers...');

      // Get all alerts joined with current coin data
      const alerts = Database.db
        .prepare(
          `
        SELECT a.*, c.name, c.symbol, c.price, c.holders, c.transfers_24h, c.market_cap, c.chain
        FROM alerts a
        JOIN coins c ON a.coin_contract = c.contract
      `
        )
        .all();

      if (!alerts || alerts.length === 0) {
        Logger.info('No alerts found to check');
        return [];
      }

      Logger.info(`Checking ${alerts.length} alerts for triggers`);

      const triggeredAlerts = [];
      const nowTimestamp = Math.floor(Date.now() / 1000);

      for (const alert of alerts) {
        // Update last_checked timestamp
        Database.db
          .prepare(
            `
          UPDATE alerts SET last_checked = ? WHERE id = ?
        `
          )
          .run(nowTimestamp, alert.id);

        // Evaluate if the alert is triggered
        const isTriggered = this.evaluateAlert(alert);

        if (isTriggered) {
          // Update last_triggered timestamp
          Database.db
            .prepare(
              `
            UPDATE alerts SET last_triggered = ? WHERE id = ?
          `
            )
            .run(nowTimestamp, alert.id);

          triggeredAlerts.push(alert);

          Logger.info(
            `Alert triggered: ${alert.id} for user ${alert.user_id} on ${alert.name} ${alert.metric}`
          );
        }
      }

      Logger.info(`Found ${triggeredAlerts.length} triggered alerts`);

      return triggeredAlerts;
    } catch (error) {
      Logger.error('Error checking alerts', { error: error.message });
      throw error;
    }
  }

  /**
   * Evaluate if an alert is triggered based on its criteria
   * @param {Object} alert - Alert object with coin data
   * @returns {boolean} True if alert condition is met
   */
  static evaluateAlert(alert) {
    try {
      const { metric, condition, threshold } = alert;

      // Get the current value of the metric from the coin data
      const value = alert[metric];

      // If metric value is not available, can't evaluate
      if (value === null || value === undefined) {
        return false;
      }

      // Evaluate based on condition
      switch (condition) {
        case 'gt':
          return value > threshold;
        case 'lt':
          return value < threshold;
        case 'eq':
          return value === threshold;
        case 'gte':
          return value >= threshold;
        case 'lte':
          return value <= threshold;
        default:
          return false;
      }
    } catch (error) {
      Logger.error('Error evaluating alert', {
        alertId: alert.id,
        error: error.message,
      });
      return false;
    }
  }
}

module.exports = AlertModel;
