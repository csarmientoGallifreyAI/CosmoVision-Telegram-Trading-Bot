/**
 * Bot Setup Script
 *
 * This script sets up the Telegram bot profile, including:
 * - Sets the bot commands
 * - Sets the bot profile photo
 * - Sets the bot description
 *
 * Run this script after deployment or when changing the bot's configuration.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { createCanvas } = require('canvas');
const Logger = require('../src/services/logger');

// Configuration
const BOT_PROFILE_PHOTO_PATH = path.join(process.cwd(), 'assets', 'bot-profile.jpg');
const API_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}/api/telegram`
  : 'http://localhost:3000/api/telegram';

/**
 * Generate a simple bot profile photo if none exists
 */
async function createDefaultProfilePhoto() {
  if (fs.existsSync(BOT_PROFILE_PHOTO_PATH)) {
    Logger.info('Bot profile photo already exists');
    return;
  }

  try {
    Logger.info('Creating default bot profile photo...');

    // Create a canvas for the profile image (must be at least 640x640px for Telegram)
    const canvas = createCanvas(640, 640);
    const ctx = canvas.getContext('2d');

    // Fill background with gradient
    const gradient = ctx.createLinearGradient(0, 0, 640, 640);
    gradient.addColorStop(0, '#6366f1'); // Indigo
    gradient.addColorStop(1, '#8b5cf6'); // Purple
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 640, 640);

    // Add a circle for the logo
    ctx.beginPath();
    ctx.arc(320, 260, 150, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fill();

    // Add text
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'white';
    ctx.fillText('🪙', 320, 300); // Coin emoji

    // Add bot name
    ctx.font = 'bold 72px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText('COSMO', 320, 450);

    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('VISION', 320, 510);

    // Save the image
    const buffer = canvas.toBuffer('image/jpeg');
    fs.writeFileSync(BOT_PROFILE_PHOTO_PATH, buffer);

    Logger.info(`Default bot profile photo created at ${BOT_PROFILE_PHOTO_PATH}`);
  } catch (error) {
    Logger.error('Error creating default bot profile photo:', { error: error.message });
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

    // Create default profile photo if needed
    await createDefaultProfilePhoto();

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
