const axios = require('axios');
const { generateKeyboard } = require('../helpers/keyboard');
const logger = require('../services/logger');

/**
 * Handler for the /dashboard command
 * Generates a one-time authentication code for the dashboard
 */
async function dashboardHandler(ctx) {
  try {
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;

    // Check if user is registered
    if (!ctx.session.user_id) {
      return ctx.reply('⚠️ You need to register first with /start before accessing the dashboard.');
    }

    // Send initial response
    await ctx.reply('🔄 Generating your dashboard access code...');

    try {
      // Request a one-time code from the API
      const response = await axios.post(
        `${process.env.API_URL || ''}/api/tradingDashboard/auth`,
        {
          action: 'generate',
          telegramId: userId,
        },
        {
          headers: {
            'x-api-key': process.env.API_SECRET_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      const { code } = response.data;

      if (!code) {
        throw new Error('No access code received from API');
      }

      // Send the code to the user
      await ctx.reply(
        `✅ Your dashboard access code: *${code}*\n\n` +
          `This code will expire in 5 minutes.\n\n` +
          `Use it to log in at:\n${
            process.env.DASHBOARD_URL || 'https://trading-dashboard.yourdomain.com'
          }`,
        {
          parse_mode: 'Markdown',
          reply_markup: generateKeyboard([
            { text: '🖥️ Open Dashboard', url: process.env.DASHBOARD_URL },
          ]),
        }
      );
    } catch (error) {
      logger.error('Error generating dashboard access code:', {
        error: error.message,
        userId,
        stack: error.stack,
      });

      await ctx.reply(
        '❌ Failed to generate dashboard access code. Please try again later.\n\n' +
          'If the problem persists, contact support.'
      );
    }
  } catch (error) {
    logger.error('Error in dashboard command:', {
      error: error.message,
      userId: ctx.from?.id,
      stack: error.stack,
    });

    await ctx.reply('❌ An error occurred while processing your request. Please try again later.');
  }
}

// Command registration information
module.exports = {
  name: 'dashboard',
  description: 'Get access to your trading dashboard',
  handler: dashboardHandler,
};
