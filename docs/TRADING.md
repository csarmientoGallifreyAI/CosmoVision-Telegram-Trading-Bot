# Trading Features

The CosmoVision bot now includes trading analysis and signal generation for meme coins and other crypto tokens. This document explains how to use these features and how they work behind the scenes.

## Available Commands

| Command               | Description                                                    |
| --------------------- | -------------------------------------------------------------- |
| `/trade`              | Open the trading dashboard with access to all trading features |
| `/signals`            | View current trading signals for meme coins                    |
| `/mytrades`           | Track your trade history and performance                       |
| `/predict <symbol>`   | Get price prediction for a specific coin                       |
| `/sentiment <symbol>` | Get sentiment analysis for a specific coin                     |
| `/coins`              | View available coins for trading                               |

## How It Works

### Trading Signals

The bot analyzes coins using the following factors:

1. **Market Cap** - Filters out extremely small-cap coins to reduce risk
2. **Sentiment Analysis** - Uses AI to gauge social sentiment from forums and social media
3. **Price Trends** - Analyzes recent price movements to identify trends
4. **Holder Growth** - Considers the rate of new holders as a bullish indicator
5. **Transaction Volume** - Evaluates trading activity as a liquidity indicator

Based on these factors, the bot generates buy or sell signals with confidence scores. Only signals with high confidence are shown.

### Trade Tracking

You can save signals to your trade portfolio, allowing you to:

- Track open trade performance
- Record closed trades with profit/loss
- Analyze your trading history
- Receive notifications on important price movements

### Sentiment Analysis

The sentiment analyzer evaluates social perception of a coin by:

1. Using AI to analyze recent mentions
2. Categorizing sentiment as positive, neutral, or negative
3. Providing a visualization of sentiment strength
4. Offering trading insights based on the sentiment

### Price Predictions

The price prediction feature combines:

1. Historical price data
2. Holder growth rates
3. Transfer activity (volume)
4. Market sentiment

To provide short-term (24-48 hour) price direction forecasts with confidence scores.

## Important Notes

- All signals and predictions are for **informational purposes only**
- Always do your own research before trading
- The bot doesn't have access to your wallet or exchange accounts
- Trading cryptocurrency, especially meme coins, involves substantial risk
- Performance metrics are based on historical data and don't guarantee future results

## Technical Implementation

The trading feature consists of several components:

- **TradingService**: Core service generating signals and predictions
- **TradeModel**: Database model for storing signals and trades
- **MarketCapService**: Gets coins with relevant market cap for analysis
- **AIProviderManager**: Provides sentiment analysis capabilities

Trading data is stored in three database tables:

- `trade_signals`: Stores active trading signals
- `user_trades`: Tracks user's active and past trades
- `trade_performance`: Records performance metrics by coin
