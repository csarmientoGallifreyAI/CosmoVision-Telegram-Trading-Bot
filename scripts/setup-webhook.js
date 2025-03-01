/**
 * Telegram Bot Webhook Setup Script
 * Helps configure the webhook URL for your Telegram bot
 */
const fetch = require('node-fetch');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function promptQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer));
  });
}

/**
 * Setup Telegram webhook for the bot
 */
async function setupWebhook() {
  console.log('🤖 Telegram Bot Webhook Setup 🤖');
  console.log('==============================\n');

  try {
    // Get bot token - use from .env or prompt
    let botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      botToken = await promptQuestion('Enter your Telegram Bot Token: ');
    } else {
      console.log(`Using bot token from .env: ${botToken.substring(0, 5)}...`);
      const confirm = await promptQuestion('Use this token? (yes/no): ');
      if (confirm.toLowerCase() !== 'yes') {
        botToken = await promptQuestion('Enter your Telegram Bot Token: ');
      }
    }

    // Get webhook URL - prompt for it
    const defaultUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/api/telegram`
      : null;

    let webhookUrl;
    if (defaultUrl) {
      console.log(`\nDetected deployment URL: ${defaultUrl}`);
      const confirm = await promptQuestion('Use this URL for webhook? (yes/no): ');
      webhookUrl =
        confirm.toLowerCase() === 'yes'
          ? defaultUrl
          : await promptQuestion(
              'Enter your webhook URL (e.g., https://yourdomain.com/api/telegram): '
            );
    } else {
      webhookUrl = await promptQuestion(
        'Enter your webhook URL (e.g., https://yourdomain.com/api/telegram): '
      );
    }

    // Check if URL is valid
    if (!webhookUrl.startsWith('https://')) {
      console.error('❌ Error: Webhook URL must use HTTPS protocol.');
      return;
    }

    // First, get current webhook info
    console.log('\n📡 Checking current webhook configuration...');
    const infoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);

    const infoData = await infoResponse.json();

    if (infoResponse.ok) {
      const currentWebhook = infoData.result.url;
      console.log(`Current webhook: ${currentWebhook || 'Not set'}`);
    } else {
      console.log('❌ Could not retrieve current webhook info:', infoData.description);
    }

    // Confirm setup
    console.log(`\n🔄 Setting webhook to: ${webhookUrl}`);
    const confirmSetup = await promptQuestion('Proceed? (yes/no): ');

    if (confirmSetup.toLowerCase() !== 'yes') {
      console.log('❌ Webhook setup cancelled.');
      rl.close();
      return;
    }

    // Set up webhook with allowed updates
    console.log('\n⚙️ Configuring webhook...');
    const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
      }),
    });

    const data = await response.json();

    if (response.ok && data.ok) {
      console.log('✅ Webhook has been set up successfully!');

      // Update .env if needed
      if (!process.env.TELEGRAM_BOT_TOKEN) {
        const updateEnv = await promptQuestion('\nUpdate .env file with this token? (yes/no): ');
        if (updateEnv.toLowerCase() === 'yes') {
          try {
            const envPath = path.join(process.cwd(), '.env');
            let envContent = '';

            // Read existing .env if it exists
            if (fs.existsSync(envPath)) {
              envContent = fs.readFileSync(envPath, 'utf8');
            }

            // Check if TELEGRAM_BOT_TOKEN is already in the file
            if (envContent.includes('TELEGRAM_BOT_TOKEN=')) {
              // Replace existing token
              envContent = envContent.replace(
                /TELEGRAM_BOT_TOKEN=.*/,
                `TELEGRAM_BOT_TOKEN=${botToken}`
              );
            } else {
              // Add new token
              envContent += `\nTELEGRAM_BOT_TOKEN=${botToken}`;
            }

            // Write updated content
            fs.writeFileSync(envPath, envContent);
            console.log('✅ .env file updated with bot token.');
          } catch (error) {
            console.error('❌ Error updating .env file:', error.message);
          }
        }
      }

      // Try to send a test message to the bot
      console.log('\n🧪 Testing bot...');
      console.log('1. Open your Telegram app');
      console.log(`2. Start a chat with your bot`);
      console.log('3. Send the message "/start" to your bot');
      console.log('If your bot responds, the webhook setup is working correctly!');
    } else {
      console.error('❌ Failed to set webhook:', data.description);
    }
  } catch (error) {
    console.error('❌ Error setting up webhook:', error.message);
  }

  rl.close();
}

// Run the setup function
setupWebhook();
