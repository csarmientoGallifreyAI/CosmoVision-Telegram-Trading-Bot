/**
 * Bot Setup Script
 *
 * This script sets up the Telegram bot profile, including:
 * - Sets the bot commands
 * - Sets the bot description
 * - Sets the bot profile photo (if provided)
 *
 * Run this script after deployment or when changing the bot's configuration.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const Logger = require('../src/services/logger');

// Configuration
const BOT_PROFILE_PHOTO_PATH = path.join(process.cwd(), 'assets', 'bot-profile.jpg');
const API_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}/api/telegram`
  : 'http://localhost:3000/api/telegram';

/**
 * Check if bot profile photo exists
 * Instead of generating one with canvas, we'll just log a message if it doesn't exist
 */
function checkProfilePhoto() {
  if (fs.existsSync(BOT_PROFILE_PHOTO_PATH)) {
    Logger.info('Bot profile photo exists at ' + BOT_PROFILE_PHOTO_PATH);
    return true;
  } else {
    Logger.info('No bot profile photo found at ' + BOT_PROFILE_PHOTO_PATH);
    Logger.info(
      'Please add a profile photo manually through BotFather or add one to assets/bot-profile.jpg'
    );
    return false;
  }
}

/**
 * Trigger the bot setup webhook endpoint
 */
async function triggerBotSetup() {
  try {
    Logger.info(`Triggering bot setup at ${API_URL}?setup=true`);

    const response = await axios.get(`${API_URL}?setup=true`);

    if (response.status === 200) {
      Logger.info('Bot setup completed successfully');
    } else {
      Logger.error('Bot setup failed:', { status: response.status, data: response.data });
    }
  } catch (error) {
    Logger.error('Error triggering bot setup:', { error: error.message });
  }
}

/**
 * Main setup function
 */
async function setup() {
  try {
    Logger.info('Starting bot setup...');

    // Create assets directory if it doesn't exist
    const assetsDir = path.join(process.cwd(), 'assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    // Check for profile photo
    checkProfilePhoto();

    // Trigger the bot setup webhook
    await triggerBotSetup();

    Logger.info('Bot setup process completed');
  } catch (error) {
    Logger.error('Error in setup process:', { error: error.message });
    process.exit(1);
  }
}

// Run the setup
setup();
