/**
 * Trading Service
 *
 * Handles trading signal generation, market analysis, and trade execution interfaces
 * for meme coins based on market cap, sentiment analysis, and price predictions.
 */

const Database = require('../database');
const Logger = require('./logger');
const MarketCapService = require('./marketCap');
const AIProviderManager = require('./aiProvider');

class TradingService {
  /**
   * Minimum market cap for trading consideration (in USD)
   * @type {number}
   */
  static MIN_MARKET_CAP = 60000; // $60,000 minimum market cap

  /**
   * Minimum expected profit per trade (in USD)
   * @type {number}
   */
  static MIN_PROFIT_TARGET = 10; // $10 minimum profit target after fees

  /**
   * Initialize the trading service
   * @returns {boolean} - Whether initialization was successful
   */
  static initialize() {
    try {
      Logger.info('Initializing Trading Service');

      // Initialize from environment variables if available
      if (process.env.MIN_MARKET_CAP) {
        this.MIN_MARKET_CAP = parseInt(process.env.MIN_MARKET_CAP);
      }

      if (process.env.MIN_PROFIT_TARGET) {
        this.MIN_PROFIT_TARGET = parseInt(process.env.MIN_PROFIT_TARGET);
      }

      Logger.info(
        `Trading Service initialized with min market cap: $${this.MIN_MARKET_CAP}, min profit target: $${this.MIN_PROFIT_TARGET}`
      );
      return true;
    } catch (error) {
      Logger.error('Failed to initialize Trading Service:', { error: error.message });
      return false;
    }
  }

  /**
   * Generate trading signals for a list of coins
   * @param {Array<Object>} coins - List of coins to analyze
   * @param {string} userId - User ID for rate limiting
   * @returns {Promise<Array<Object>>} - List of trading signals
   */
  static async generateTradingSignals(coins, userId = 'system') {
    const signals = [];

    try {
      Logger.info(`Generating trading signals for ${coins.length} coins`);

      for (const coin of coins) {
        try {
          // Skip coins with insufficient market cap
          if (!coin.market_cap || coin.market_cap < this.MIN_MARKET_CAP) {
            Logger.debug(
              `Skipping ${coin.name} - Market cap below threshold: $${coin.market_cap || 'unknown'}`
            );
            continue;
          }

          // Analyze sentiment for the coin
          const sentiment = await this.analyzeSentiment(coin, userId);

          // Predict price movements
          const prediction = await this.predictPriceMovement(coin, userId);

          // Calculate potential profit
          const potentialProfit = this.calculatePotentialProfit(coin, prediction);

          // Generate signal if criteria are met
          if (this.shouldGenerateSignal(sentiment, prediction, potentialProfit)) {
            signals.push({
              coin,
              type: prediction.direction === 'up' ? 'buy' : 'sell',
              confidence: prediction.confidence,
              sentiment: sentiment.score,
              potentialProfit,
              reason: this.generateSignalReason(sentiment, prediction),
              timestamp: Date.now(),
            });

            Logger.info(
              `Generated ${prediction.direction === 'up' ? 'BUY' : 'SELL'} signal for ${
                coin.name
              } (${coin.symbol})`
            );
          }
        } catch (coinError) {
          Logger.error(`Error processing coin ${coin.name || coin.symbol}:`, {
            error: coinError.message,
          });
          // Continue processing other coins
        }
      }

      return signals;
    } catch (error) {
      Logger.error('Error generating trading signals:', { error: error.message });
      return [];
    }
  }

  /**
   * Analyze sentiment for a coin using social media and news data
   * @param {Object} coin - Coin to analyze
   * @param {string} userId - User ID for rate limiting
   * @returns {Promise<Object>} - Sentiment analysis result
   */
  static async analyzeSentiment(coin, userId) {
    try {
      // Default sentiment if analysis fails
      let sentiment = { score: 0.5, magnitude: 0.5, source: 'default' };

      // First, try to get recent social media mentions using the AIProviderManager
      const query = `${coin.name} ${coin.symbol} crypto sentiment`;

      try {
        // Use the AIProviderManager to process the query
        const result = await AIProviderManager.processQuery(query, userId);

        if (result) {
          // Extract sentiment from the result
          // Higher confidence scores are treated as more positive sentiment
          sentiment = {
            score: result.confidence || 0.5,
            magnitude: 0.7, // Default magnitude
            source: 'ai',
          };
        }
      } catch (aiError) {
        Logger.debug(`AI sentiment analysis failed for ${coin.name}:`, { error: aiError.message });
        // Continue with default sentiment
      }

      // Categorize sentiment
      let category;
      if (sentiment.score >= 0.7) category = 'positive';
      else if (sentiment.score <= 0.3) category = 'negative';
      else category = 'neutral';

      return {
        ...sentiment,
        category,
      };
    } catch (error) {
      Logger.error(`Error analyzing sentiment for ${coin.name}:`, { error: error.message });
      // Return neutral sentiment on error
      return { score: 0.5, magnitude: 0.5, category: 'neutral', source: 'error' };
    }
  }

  /**
   * Predict price movement for a coin
   * @param {Object} coin - Coin to analyze
   * @param {string} userId - User ID for rate limiting
   * @returns {Promise<Object>} - Price prediction result
   */
  static async predictPriceMovement(coin, userId) {
    try {
      // Get historical metrics for the coin
      const priceHistory = await Database.getHistoricalMetrics(coin.contract, 'price', 7);
      const transfersHistory = await Database.getHistoricalMetrics(
        coin.contract,
        'transfers_24h',
        7
      );
      const holdersHistory = await Database.getHistoricalMetrics(coin.contract, 'holders', 7);

      // Check if we have enough historical data
      if (priceHistory.length < 3) {
        Logger.debug(`Insufficient price history for ${coin.name} - Using sentiment only`);

        // If no price history, rely on sentiment
        // Call sentiment analysis if we haven't already
        const sentiment = await this.analyzeSentiment(coin, userId);

        // Convert sentiment to a prediction
        return {
          direction: sentiment.score > 0.6 ? 'up' : sentiment.score < 0.4 ? 'down' : 'stable',
          confidence: sentiment.score > 0.6 || sentiment.score < 0.4 ? 0.5 : 0.3,
          expectedChange: sentiment.score > 0.6 ? 0.05 : sentiment.score < 0.4 ? -0.05 : 0.01,
          source: 'sentiment',
        };
      }

      // Calculate recent price trend
      const recentPrices = priceHistory
        .map((entry) => entry.value)
        .sort((a, b) => a.timestamp - b.timestamp);

      // Calculate percentage change over the period
      const oldestPrice = recentPrices[0];
      const latestPrice = recentPrices[recentPrices.length - 1];
      const priceChange = oldestPrice > 0 ? (latestPrice - oldestPrice) / oldestPrice : 0;

      // Analyze holder growth (bullish indicator)
      let holderGrowth = 0;
      if (holdersHistory.length >= 2) {
        const oldestHolders = holdersHistory[0].value;
        const latestHolders = holdersHistory[holdersHistory.length - 1].value;
        holderGrowth = oldestHolders > 0 ? (latestHolders - oldestHolders) / oldestHolders : 0;
      }

      // Analyze transfer activity (volume indicator)
      let transferGrowth = 0;
      if (transfersHistory.length >= 2) {
        const oldestTransfers = transfersHistory[0].value;
        const latestTransfers = transfersHistory[transfersHistory.length - 1].value;
        transferGrowth =
          oldestTransfers > 0 ? (latestTransfers - oldestTransfers) / oldestTransfers : 0;
      }

      // Combine factors to predict direction and confidence

      // Strong buy signal: Price trending up + growing holders + increasing transfers
      if (priceChange > 0.03 && holderGrowth > 0.02 && transferGrowth > 0.05) {
        return {
          direction: 'up',
          confidence: 0.8,
          expectedChange: 0.15,
          source: 'analysis',
        };
      }

      // Moderate buy signal: Price stable or slightly up + growing holders
      if (priceChange >= 0 && holderGrowth > 0.01) {
        return {
          direction: 'up',
          confidence: 0.6,
          expectedChange: 0.08,
          source: 'analysis',
        };
      }

      // Sell signal: Price declining + holder growth slowing or declining
      if (priceChange < -0.05 || (priceChange < 0 && holderGrowth <= 0)) {
        return {
          direction: 'down',
          confidence: 0.7,
          expectedChange: -0.1,
          source: 'analysis',
        };
      }

      // Default to neutral/hold
      return {
        direction: 'stable',
        confidence: 0.4,
        expectedChange: 0.01,
        source: 'analysis',
      };
    } catch (error) {
      Logger.error(`Error predicting price movement for ${coin.name}:`, { error: error.message });
      // Return neutral prediction on error
      return {
        direction: 'stable',
        confidence: 0.3,
        expectedChange: 0,
        source: 'error',
      };
    }
  }

  /**
   * Calculate potential profit for a trade
   * @param {Object} coin - Coin to analyze
   * @param {Object} prediction - Price prediction
   * @returns {number} - Potential profit in USD
   */
  static calculatePotentialProfit(coin, prediction) {
    // Simple profit calculation: current price * expected change * typical trade amount
    const typicalTradeAmount = 100; // $100 typical trade
    const estimatedFees = 2; // $2 in network and exchange fees

    if (!coin.price) return 0;

    const potentialProfit =
      coin.price * Math.abs(prediction.expectedChange) * typicalTradeAmount - estimatedFees;
    return Math.max(0, potentialProfit);
  }

  /**
   * Determine if a signal should be generated based on analysis
   * @param {Object} sentiment - Sentiment analysis result
   * @param {Object} prediction - Price prediction
   * @param {number} potentialProfit - Potential profit
   * @returns {boolean} - Whether to generate a signal
   */
  static shouldGenerateSignal(sentiment, prediction, potentialProfit) {
    // Generate buy signals when:
    // 1. Direction is up with good confidence
    // 2. Potential profit meets minimum target
    // 3. Sentiment is not negative
    if (
      prediction.direction === 'up' &&
      prediction.confidence >= 0.6 &&
      potentialProfit >= this.MIN_PROFIT_TARGET &&
      sentiment.category !== 'negative'
    ) {
      return true;
    }

    // Generate sell signals when:
    // 1. Direction is down with good confidence
    // 2. Sentiment is negative or neutral
    if (
      prediction.direction === 'down' &&
      prediction.confidence >= 0.7 &&
      (sentiment.category === 'negative' || sentiment.category === 'neutral')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Generate a human-readable reason for the signal
   * @param {Object} sentiment - Sentiment analysis
   * @param {Object} prediction - Price prediction
   * @returns {string} - Signal reason
   */
  static generateSignalReason(sentiment, prediction) {
    const sentimentText =
      sentiment.category === 'positive'
        ? 'positive social sentiment'
        : sentiment.category === 'negative'
        ? 'negative social sentiment'
        : 'neutral sentiment';

    const predictionText =
      prediction.direction === 'up'
        ? `expected ${(prediction.expectedChange * 100).toFixed(1)}% price increase`
        : prediction.direction === 'down'
        ? `expected ${(Math.abs(prediction.expectedChange) * 100).toFixed(1)}% price decrease`
        : 'stable price prediction';

    return `Based on ${sentimentText} and ${predictionText}`;
  }

  /**
   * Generate a transaction for a DEX trade (e.g., PancakeSwap, Uniswap)
   * @param {Object} coin - Coin to trade
   * @param {string} direction - 'buy' or 'sell'
   * @param {number} amount - Amount to trade in USD
   * @returns {Object} - Transaction data and link
   */
  static generateTradeTransaction(coin, direction, amount = 100) {
    try {
      if (!coin.contract || !coin.chain) {
        throw new Error('Missing contract address or chain information');
      }

      // Currently supporting BSC (PancakeSwap) and ETH (Uniswap)
      let dexUrl;
      let tradeType = direction === 'buy' ? 'swap' : 'swap';

      // Default to WBNB/WETH as the payment token
      const paymentToken =
        coin.chain === 'BSC'
          ? '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c' // WBNB on BSC
          : '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; // WETH on Ethereum

      if (coin.chain === 'BSC') {
        // PancakeSwap URL
        dexUrl = `https://pancakeswap.finance/swap?outputCurrency=${coin.contract}`;
      } else if (coin.chain === 'ETH') {
        // Uniswap URL
        dexUrl = `https://app.uniswap.org/#/swap?outputCurrency=${coin.contract}`;
      } else if (coin.chain === 'NEAR') {
        // Ref Finance URL (NEAR)
        dexUrl = `https://app.ref.finance/`;
        // Ref.finance doesn't support direct linking with tokens yet
      } else {
        throw new Error(`Unsupported chain: ${coin.chain}`);
      }

      return {
        dex:
          coin.chain === 'BSC' ? 'PancakeSwap' : coin.chain === 'ETH' ? 'Uniswap' : 'Ref Finance',
        chain: coin.chain,
        contract: coin.contract,
        direction,
        url: dexUrl,
        suggestedAmount: amount,
        paymentToken,
        timestamp: Date.now(),
      };
    } catch (error) {
      Logger.error(`Error generating trade transaction for ${coin.name}:`, {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get active trading signals from database
   * @param {number} limit - Maximum number of signals to return
   * @returns {Promise<Array<Object>>} - List of active trading signals
   */
  static async getActiveSignals(limit = 10) {
    try {
      // This assumes you'll create a signals table in the database
      // For now, returning an empty array
      return [];
    } catch (error) {
      Logger.error('Error fetching active signals:', { error: error.message });
      return [];
    }
  }

  /**
   * Generate daily trading signals
   * Analyzes all eligible coins and generates signals based on market cap, sentiment, and price trends
   * @returns {Promise<Array<Object>>} - Array of generated signals
   */
  static async generateDailySignals() {
    try {
      Logger.info('Starting daily trading signal generation');

      // Get coins above minimum market cap
      const minMarketCap = this.MIN_MARKET_CAP;
      const coins = await MarketCapService.getCoinsAboveMarketCap(minMarketCap);

      if (coins.length === 0) {
        Logger.warn(`No coins found with market cap above $${minMarketCap}`);
        return [];
      }

      Logger.info(`Found ${coins.length} coins above minimum market cap, analyzing for signals`);

      // Generate signals for eligible coins
      const signals = await this.generateTradingSignals(coins);

      // Save signals to database
      const savedSignals = [];
      const TradeModel = require('../models/tradeModel');

      for (const signal of signals) {
        try {
          const signalId = await TradeModel.saveSignal(signal);
          if (signalId) {
            savedSignals.push({ ...signal, id: signalId });
          }
        } catch (saveError) {
          Logger.error(`Error saving signal for ${signal.coin.name}:`, {
            error: saveError.message,
            coin: signal.coin.name,
          });
        }
      }

      // Expire old signals
      try {
        const expiredCount = await TradeModel.expireOldSignals();
        Logger.info(`Expired ${expiredCount} old signals`);
      } catch (expireError) {
        Logger.error('Error expiring old signals:', { error: expireError.message });
      }

      // Check outcomes of previously expired signals
      try {
        const updatedCount = await TradeModel.checkAndUpdateSignalOutcomes();
        Logger.info(`Updated outcomes for ${updatedCount} expired signals`);
      } catch (outcomeError) {
        Logger.error('Error updating signal outcomes:', { error: outcomeError.message });
      }

      Logger.info(`Generated and saved ${savedSignals.length} trading signals`);
      return savedSignals;
    } catch (error) {
      Logger.error('Error generating daily signals:', { error: error.message });
      return [];
    }
  }
}

module.exports = TradingService;
