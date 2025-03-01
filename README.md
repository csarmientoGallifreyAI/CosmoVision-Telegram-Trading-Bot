# Meme Coin Analysis Telegram Bot

A simple Telegram bot for analyzing meme coin opportunities on gra.fun, focusing on Binance Smart Chain (BSC) tokens.

## Features

- Scrapes meme coin data from gra.fun
- Retrieves on-chain metrics (holders, recent transfers) using BscScan API
- Provides an easy-to-use Telegram bot interface
- Low-cost implementation using free or affordable tools

## Metrics Tracked

- **Number of holders**: Indicates community size and adoption
- **Recent trading activity**: Number of transfers in the last 24 hours
- **Current price**: Current value of the coin

## Setup

1. Clone this repository
2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

   > **Note:** This project uses python-telegram-bot v13.15 which requires APScheduler v3.6.3 specifically. Using a different version of APScheduler will cause dependency conflicts.

3. Copy `.env.example` to `.env` and fill in your API keys:

   ```bash
   cp .env.example .env
   ```

4. Create a Telegram bot using BotFather and get your token
5. Get a free API key from BscScan
6. Update the `.env` file with your tokens and keys
7. Run the bot:

   ```bash
   # Run from the project root as a module
   python -m src.main

   # Or run directly (now fixed to work from any directory)
   python src/main.py

   # Test mode (won't start the Telegram bot, useful for testing scraper/database)
   python src/main.py --test
   ```

## Usage

In Telegram, use the following commands:

- `/analyze <coin_name>` or `/analyze <symbol>` - Get analysis for a specific coin

## Deployment

The bot can be deployed on free tier services like:

- Heroku
- PythonAnywhere
- Railway

## License

MIT
