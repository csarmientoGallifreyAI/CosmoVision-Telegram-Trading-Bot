# Cosmovision Telegram Bot

A Telegram bot that provides analysis and metrics for meme coins. The bot scrapes data from sources like gra.fun and blockchain APIs to provide valuable insights about meme coins.

## Features

- Search for meme coins by name or symbol
- Get price, holder count, and 24-hour transfer metrics
- Analyze activity ratios to identify active vs. dormant tokens
- Automatic data updates every 6 hours

## Technology

- Node.js
- Telegraf (Telegram Bot Framework)
- SQLite (for local data storage)
- Vercel serverless functions for deployment

## Setup Instructions

### Prerequisites

- Node.js 14+
- A Telegram Bot Token (get from [@BotFather](https://t.me/BotFather))
- Etherscan API Key (optional, for blockchain data)
- Vercel account for deployment

### Local Development

1. Clone the repository:

```bash
git clone git@github.com:csarmientoGallifreyAI/cosmovision_tg_bot.git
cd cosmovision_tg_bot
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file with your configuration:

```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
ETHERSCAN_API_KEY=your_etherscan_api_key
UPDATE_AUTH_KEY=a_secret_key_for_data_updates
```

4. Run locally with Vercel dev:

```bash
npm run dev
```

### Deployment to Vercel

1. Install Vercel CLI if you haven't already:

```bash
npm install -g vercel
```

2. Login to Vercel:

```bash
vercel login
```

3. Deploy the project:

```bash
vercel --prod
```

4. Set up your environment variables in the Vercel dashboard.

5. Configure the Telegram webhook using the setup script:

```bash
node scripts/setup-webhook.js
```

## Webhook Setup

After deployment, you need to configure your Telegram bot to use webhooks:

1. Run the webhook setup script:

```bash
node scripts/setup-webhook.js
```

2. Follow the prompts to enter your bot token and webhook URL.

3. Verify the webhook is working by visiting:
   `https://your-vercel-app.vercel.app/api/test`

## Architecture

The bot is designed to work with Vercel's serverless functions:

- `/api/telegram.js` - Handles Telegram webhook requests
- `/api/update-data.js` - Scheduled job to update coin data
- `/api/test.js` - Test endpoint to verify deployment

Data is stored in an SQLite database, which is compatible with Vercel's read-only filesystem for the deployment.

## Troubleshooting

If your bot isn't responding, check the following:

1. Verify webhook configuration using the Telegram API:
   `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo`

2. Check the Vercel logs for any errors.

3. Make sure your environment variables are set correctly in Vercel.

4. Test the `/api/test` endpoint to verify the API is working.

## License

MIT
