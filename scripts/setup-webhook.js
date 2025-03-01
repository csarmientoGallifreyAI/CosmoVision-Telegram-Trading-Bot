const fetch = require('node-fetch');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function promptForInput(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  try {
    console.log('\n=== Telegram Bot Webhook Setup ===\n');

    // Get bot token
    const token = await promptForInput('Enter your Telegram Bot Token: ');
    if (!token || token.trim() === '') {
      throw new Error('Bot token is required');
    }

    // Get webhook URL
    console.log('\nYour webhook URL should be your Vercel deployment URL + /api/telegram');
    console.log('Example: https://your-vercel-app.vercel.app/api/telegram\n');

    const webhookUrl = await promptForInput('Enter your webhook URL: ');
    if (!webhookUrl || !webhookUrl.startsWith('https://')) {
      throw new Error('Webhook URL must be a valid HTTPS URL');
    }

    console.log('\nSetting up webhook...');

    // Get current webhook info
    const infoResponse = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const infoData = await infoResponse.json();

    console.log('\nCurrent webhook configuration:');
    console.log(JSON.stringify(infoData, null, 2));

    // Delete existing webhook if any
    console.log('\nDeleting existing webhook...');
    await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);

    // Set the new webhook
    console.log(`\nSetting new webhook to: ${webhookUrl}`);
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
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

    if (data.ok) {
      console.log('\n✅ Webhook set successfully!');

      // Get webhook info to verify
      const verifyResponse = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
      const verifyData = await verifyResponse.json();

      console.log('\nNew webhook configuration:');
      console.log(JSON.stringify(verifyData, null, 2));

      console.log('\n✅ Setup completed successfully!');
      console.log('\nMake sure to set the following environment variables in your Vercel project:');
      console.log('- TELEGRAM_BOT_TOKEN');
      console.log('- ETHERSCAN_API_KEY (if using blockchain data)');
      console.log('- UPDATE_AUTH_KEY (for securing the data update endpoint)');
    } else {
      console.error('\n❌ Failed to set webhook:', data.description);
    }
  } catch (error) {
    console.error('\n❌ Error setting up webhook:', error.message);
  } finally {
    rl.close();
  }
}

main();
