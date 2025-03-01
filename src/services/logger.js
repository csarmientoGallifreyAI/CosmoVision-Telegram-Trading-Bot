/**
 * Logger service for structured logging
 * Provides centralized logging with levels, context, and formatting
 */
class Logger {
  static levels = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  static currentLevel =
    process.env.NODE_ENV === 'production' ? this.levels.INFO : this.levels.DEBUG;

  static log(level, message, context = {}) {
    if (this.levels[level] > this.currentLevel) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...context,
    };

    // For local dev, pretty print
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${timestamp}] ${level}: ${message}`, context);
      return;
    }

    // In production, output structured JSON for log aggregation
    console.log(JSON.stringify(logEntry));

    // Critical errors could trigger notifications
    if (level === 'ERROR' && process.env.ADMIN_CHAT_ID) {
      this.notifyAdmin(message, context);
    }
  }

  static error(message, context = {}) {
    this.log('ERROR', message, context);
  }

  static warn(message, context = {}) {
    this.log('WARN', message, context);
  }

  static info(message, context = {}) {
    this.log('INFO', message, context);
  }

  static debug(message, context = {}) {
    this.log('DEBUG', message, context);
  }

  static async notifyAdmin(message, context) {
    try {
      // If we have a bot and admin chat ID, we can notify admins about critical errors
      if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.ADMIN_CHAT_ID) {
        return;
      }

      const { Telegraf } = require('telegraf');
      const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

      const errorMessage = `⚠️ *CRITICAL ERROR*\n\n${message}\n\n\`\`\`${JSON.stringify(
        context,
        null,
        2
      )}\`\`\``;

      await bot.telegram.sendMessage(process.env.ADMIN_CHAT_ID, errorMessage, {
        parse_mode: 'Markdown',
      });
    } catch (e) {
      // Don't recursively log errors from here
      console.error('Failed to notify admin:', e);
    }
  }
}

module.exports = Logger;
