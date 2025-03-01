# Deployment Guide for CosmoVision Telegram Bot

This guide provides instructions for deploying the CosmoVision Telegram Bot to Vercel.

## Prerequisites

- [Vercel account](https://vercel.com/signup)
- [Telegram Bot Token](https://core.telegram.org/bots#how-do-i-create-a-bot) (from BotFather)
- Required API keys (see `.env.example`)

## Environment Setup

1. Copy `.env.example` to `.env.local` for local development
2. Add all required API keys and configuration values
3. Ensure `TELEGRAM_BOT_USERNAME` is set to your bot's username (without the '@' symbol)

## Deployment Steps

### 1. Install Vercel CLI (optional, for local development)

```bash
npm install -g vercel
```

### 2. Local Development

```bash
# Set up local development environment
npm run dev

# Generate auth key for update-data endpoint
npm run generate-key

# Set up webhook (points Telegram to your bot)
npm run webhook

# Generate embeddings (initialize database)
npm run generate-embeddings

# Set up bot (commands, description)
npm run setup-bot
```

### 3. Deploy to Vercel

```bash
# Deploy to production
npm run deploy
```

Or connect your GitHub repository to Vercel for automatic deployments.

## Important Notes on Vercel Deployment

### Bot Profile Photo

Due to limitations in Vercel's serverless environment, the bot profile photo must be set manually:

1. Use BotFather's `/setuserpic` command directly in Telegram
2. Chat with BotFather, select your bot, and follow the instructions to upload an image

### Vercel Environment Limitations

Vercel's serverless functions have several limitations:

1. No native dependencies that require compilation (e.g., canvas)
2. Limited execution time (10-60 seconds depending on plan)
3. Limited storage (stateless functions)

### Database Persistence

The SQLite database (`data/coins.db`) needs to be persisted between deployments. Vercel does not provide persistent storage between function invocations.

Solutions:

1. Use the `/api/update-data` endpoint with a scheduled external trigger (recommended)
2. Consider using a hosted database instead of SQLite for production

## Troubleshooting

### Webhook Issues

If the webhook is not working:

1. Verify your bot token
2. Ensure the webhook URL is correct (should be `https://your-vercel-deployment.vercel.app/api/telegram`)
3. Check Vercel logs for errors

### Deployment Errors

If deployment fails:

1. Check for dependencies that require native compilation
2. Ensure all environment variables are set in Vercel's project settings
3. Verify the deployment logs for specific errors

### Rate Limiting

The bot implements rate limiting to prevent API abuse. If users report rate limit issues:

1. Adjust the rate limits in `src/services/rateLimit.js`
2. Add important users to the exemption list
