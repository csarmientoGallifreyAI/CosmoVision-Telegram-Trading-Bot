# CosmoVision Trading Dashboard

A cyberpunk-themed dashboard for monitoring and managing meme coin trading signals from the CosmoVision Telegram bot.

## Features

- **Trading Signals**: View and filter active trading signals
- **Trade Tracking**: Monitor your trading history and performance
- **Performance Analytics**: Analyze win rates and profit/loss metrics
- **Secure Authentication**: Login using your Telegram ID and auth code

## Cyberpunk UI

The dashboard features a distinctive cyberpunk aesthetic with:

- Neon glowing effects
- Dark background with grid patterns
- Futuristic typography with the Orbitron font
- High contrast color scheme

## Technology Stack

- **Next.js**: React framework for the frontend
- **Tailwind CSS**: Utility-first CSS framework for styling
- **JWT Authentication**: Secure authentication with JSON Web Tokens
- **API Integration**: Connection to the CosmoVision bot's trading API

## Setup & Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables:
   Create a `.env.local` file with:

   ```
   NEXT_PUBLIC_API_URL=http://localhost:3000
   ```

3. Run the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3001](http://localhost:3001) in your browser

## Authentication

To use the dashboard, you need:

1. A Telegram account that uses the CosmoVision bot
2. Your Telegram user ID
3. An authentication code (obtained from the bot by using the `/dashboard` command)

## Deployment

The dashboard is designed to be deployed to Vercel:

```bash
vercel
```

## Branding

This dashboard is powered by: **Lagrimas de zurdo**

## License

MIT
