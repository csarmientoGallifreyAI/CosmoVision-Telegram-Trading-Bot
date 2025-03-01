# Cosmovision Telegram Bot

A Telegram bot that provides analysis and metrics for meme coins. The bot scrapes data from sources like gra.fun and blockchain APIs to provide valuable insights about meme coins.

## Features

- Search for meme coins by name or symbol
- Get price, holder count, 24-hour transfer metrics, and market cap
- Analyze activity ratios to identify active vs. dormant tokens
- Set alerts for price, holders, transfers, and market cap changes
- Multi-chain support: BSC and NEAR Protocol
- Automatic data updates every 6 hours
- Enhanced error handling and logging
- Performance optimization with caching
- AI-powered analysis using OpenAI, Hugging Face, and local models
- Natural language understanding for intuitive queries
- Referral system with tracking and rewards
- Trend analysis and risk assessment for coins

## Technology

- Node.js
- Telegraf (Telegram Bot Framework)
- SQLite (for local data storage)
- Vercel serverless functions for deployment
- NEAR API JS for NEAR blockchain integration
- BSCScan API for Binance Smart Chain data
- TensorFlow.js for local AI model inference
- OpenAI and Hugging Face APIs for AI capabilities
- Intelligent caching with disk persistence

## Setup Instructions

### Prerequisites

- Node.js 14+
- A Telegram Bot Token (get from [@BotFather](https://t.me/BotFather))
- Etherscan API Key (for BSC blockchain data)
- OpenAI API Key (for AI capabilities, optional)
- Hugging Face API Key (for AI capabilities, optional)
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

3. Create a `.env` file with your configuration (see `.env.example` for all options):

```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_BOT_USERNAME=your_bot_username_without_@
ETHERSCAN_API_KEY=your_etherscan_api_key
UPDATE_AUTH_KEY=a_secret_key_for_data_updates
ADMIN_CHAT_ID=your_telegram_chat_id_for_critical_alerts
OPENAI_API_KEY=your_openai_api_key
HUGGINGFACE_API_KEY=your_huggingface_api_key
```

4. (Optional) Download local models for offline AI capabilities:

```bash
npm run download-model -- --model="sentence-transformers/all-MiniLM-L6-v2"
```

5. Run locally with Vercel dev:

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

## Bot Commands

- `/start` - Begin interacting with the bot
- `/help` - Show available commands
- `/analyze <coin>` - Get detailed analysis for a coin
- `/discover <query>` - Find coins matching specific criteria
- `/similar <coin>` - Find coins similar to a specific one
- `/trend <coin>` - Get AI-powered trend analysis
- `/risk <coin>` - Get risk assessment for a coin
- `/setalert <coin> <metric> <condition> <threshold>` - Set an alert
- `/myalerts` - View your active alerts
- `/removealert <number>` - Remove an alert
- `/share` - Get your referral link to share with friends
- `/referrals` - View your referrals and earned points
- `/usage` - Check your API usage statistics

## Architecture

The bot is designed to work with Vercel's serverless functions:

- `/api/telegram.js` - Handles Telegram webhook requests
- `/api/update-data.js` - Scheduled job to update coin data
- `/api/test.js` - Test endpoint to verify deployment

Data is stored in an SQLite database in the `/tmp` directory when deployed on Vercel.

### Components

- **Logger Service**: Structured logging with severity levels
- **Cache Service**: In-memory and disk caching to reduce external API calls
- **Blockchain Adapters**: Chain-specific code for BSC and NEAR
- **Alert System**: User-configurable alerts for various metrics
- **Market Cap Service**: Calculation and tracking of market capitalization
- **AI Provider Manager**: Intelligent switching between AI providers
- **Local Models Service**: Run AI models locally for offline capabilities
- **Rate Limiter**: Control API usage to prevent abuse

## AI Capabilities

The bot leverages several AI systems to provide intelligent analysis:

### Provider Management

The `AIProviderManager` automatically selects the best AI provider based on:

- Availability
- Error rates
- Rate limits
- User preferences

It seamlessly falls back to alternative providers if the primary one is unavailable.

### Local Models

For reduced API costs and offline capabilities, the bot can use local TensorFlow.js models:

1. Download models using the `download-model` script:

   ```bash
   npm run download-model -- --model="sentence-transformers/all-MiniLM-L6-v2"
   ```

2. Configure the local models directory in `.env`:

   ```
   LOCAL_MODELS_DIR=models
   LOCAL_EMBEDDING_MODEL=sentence-transformers_all-MiniLM-L6-v2
   ```

3. Local models will be used automatically when API providers are unavailable or for specific operations.

### Natural Language Understanding

The bot understands natural language queries about coins, allowing users to ask questions like:

- "Show me coins with over 1000 holders on BSC"
- "What's the current price of DOGE?"
- "Find coins with high growth potential"

## Intelligent Caching

The bot implements a sophisticated caching system:

- **Memory Cache**: Fast in-memory storage for frequent queries
- **Disk Cache**: Persistent storage for embeddings and other computationally expensive results
- **Configurable TTL**: Different expiration times for different types of data
- **Automatic Cleanup**: Stale data is removed to maintain performance

## Security

The update endpoint is protected with an authentication key. Set the `UPDATE_AUTH_KEY` environment variable and include it in requests as the `x-auth-key` header.

## Data Limitations

When deployed on Vercel, the SQLite database is stored in the `/tmp` directory, which is ephemeral. This means data may be reset periodically. For production use, consider:

1. Implementing a backup system to periodically export data
2. Migrating to a cloud database solution

## Troubleshooting

If your bot isn't responding, check the following:

1. Verify webhook configuration using the Telegram API:
   `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo`

2. Check the Vercel logs for any errors.

3. Make sure your environment variables are set correctly in Vercel.

4. Test the `/api/test` endpoint to verify the API is working.

5. For issues with AI capabilities:
   - Verify API keys are set correctly
   - Check if local models are downloaded and configured properly
   - Review logs for error messages from AI providers

## License

MIT
