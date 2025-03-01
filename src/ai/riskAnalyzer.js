/**
 * RiskAnalyzer provides risk assessment for meme coins
 * based on various metrics and historical patterns.
 */
const Database = require('../database');
const CacheService = require('../services/cache');
const Logger = require('../services/logger');

class RiskAnalyzer {
  /**
   * Calculate a comprehensive risk score for a coin
   * @param {Object} coin - Coin object with metrics
   * @returns {Object} - Risk assessment results
   */
  static async calculateRiskScore(coin) {
    try {
      // Cache risk scores to avoid recomputation
      const cacheKey = `risk_score_${coin.contract}_${coin.last_updated}`;
      return await CacheService.getOrFetch(
        cacheKey,
        async () => {
          // Extract required metrics
          const {
            holders = 0,
            transfers_24h = 0,
            price = 0,
            market_cap = 0,
            last_updated = 0,
            contract = '',
            chain = 'BSC',
          } = coin;

          // Get historical data for volatility and trend analysis
          const priceHistory = await Database.getHistoricalMetrics(contract, 'price', 7);
          const holderHistory = await Database.getHistoricalMetrics(contract, 'holders', 7);

          Logger.debug(`Calculating risk score for ${coin.name}`, {
            priceHistoryPoints: priceHistory.length,
            holderHistoryPoints: holderHistory.length,
          });

          // Calculate individual risk factors (0-100 scale, higher = more risky)
          const riskFactors = {
            // Low holder count is risky (whale manipulation risk)
            holderConcentration: this.calculateHolderRisk(holders),

            // High volatility is risky
            priceVolatility: this.calculateVolatilityRisk(priceHistory),

            // Low liquidity/market cap is risky
            liquidity: this.calculateLiquidityRisk(market_cap, transfers_24h),

            // Young coins are riskier
            age: this.calculateAgeRisk(coin),

            // Sudden holder changes can indicate pump and dump
            holderChange: this.calculateHolderChangeRisk(holderHistory),
          };

          // Weight the risk factors based on their importance
          const weights = {
            holderConcentration: 0.3,
            priceVolatility: 0.2,
            liquidity: 0.25,
            age: 0.1,
            holderChange: 0.15,
          };

          // Calculate weighted average risk score
          const totalRisk = Object.keys(riskFactors).reduce((sum, factor) => {
            return sum + riskFactors[factor] * weights[factor];
          }, 0);

          // Determine risk category based on total score
          let riskCategory;
          if (totalRisk < 25) riskCategory = 'Low';
          else if (totalRisk < 50) riskCategory = 'Moderate';
          else if (totalRisk < 75) riskCategory = 'High';
          else riskCategory = 'Very High';

          return {
            score: Math.round(totalRisk),
            category: riskCategory,
            factors: riskFactors,
          };
        },
        3600
      ); // Cache for 1 hour
    } catch (error) {
      Logger.error('Error calculating risk score:', { error: error.message, coin: coin.name });
      // Return a default moderate risk score on error
      return {
        score: 50,
        category: 'Moderate',
        factors: {
          holderConcentration: 50,
          priceVolatility: 50,
          liquidity: 50,
          age: 50,
          holderChange: 50,
        },
      };
    }
  }

  /**
   * Calculate risk based on holder count
   * @param {number} holders - Number of token holders
   * @returns {number} - Risk score (0-100)
   */
  static calculateHolderRisk(holders) {
    // Fewer holders = higher risk of manipulation
    if (holders < 100) return 90;
    if (holders < 500) return 70;
    if (holders < 1000) return 50;
    if (holders < 5000) return 30;
    if (holders < 10000) return 20;
    return 10;
  }

  /**
   * Calculate risk based on price volatility
   * @param {Array} priceHistory - Historical price data
   * @returns {number} - Risk score (0-100)
   */
  static calculateVolatilityRisk(priceHistory) {
    if (priceHistory.length < 2) return 50; // Default with insufficient data

    try {
      // Calculate volatility as standard deviation of daily returns
      const returns = [];
      for (let i = 1; i < priceHistory.length; i++) {
        const prevPrice = priceHistory[i - 1].value;
        const currentPrice = priceHistory[i].value;
        if (prevPrice > 0) {
          returns.push((currentPrice - prevPrice) / prevPrice);
        }
      }

      if (returns.length === 0) return 50;

      const mean = returns.reduce((sum, val) => sum + val, 0) / returns.length;
      const variance =
        returns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / returns.length;
      const volatility = Math.sqrt(variance);

      // Convert to 0-100 scale (higher volatility = higher risk)
      // A volatility of 0.15 (15%) daily is considered very high
      return Math.min(100, Math.max(0, volatility * 500));
    } catch (error) {
      Logger.error('Error calculating volatility risk:', { error: error.message });
      return 50; // Default moderate risk on error
    }
  }

  /**
   * Calculate risk based on liquidity and market cap
   * @param {number} marketCap - Market capitalization
   * @param {number} transfers24h - Number of transfers in last 24h
   * @returns {number} - Risk score (0-100)
   */
  static calculateLiquidityRisk(marketCap, transfers24h) {
    // No market cap data is very risky
    if (!marketCap) return 90;

    // Lower market cap = higher risk
    let marketCapRisk;
    if (marketCap < 10000) marketCapRisk = 90;
    else if (marketCap < 100000) marketCapRisk = 70;
    else if (marketCap < 1000000) marketCapRisk = 50;
    else if (marketCap < 10000000) marketCapRisk = 30;
    else marketCapRisk = 10;

    // Low trading activity = higher risk (less liquid)
    let activityRisk;
    if (transfers24h < 10) activityRisk = 90;
    else if (transfers24h < 50) activityRisk = 70;
    else if (transfers24h < 200) activityRisk = 50;
    else if (transfers24h < 1000) activityRisk = 30;
    else activityRisk = 10;

    // Combine with 70% weight on market cap, 30% on activity
    return marketCapRisk * 0.7 + activityRisk * 0.3;
  }

  /**
   * Calculate risk based on coin age
   * @param {Object} coin - Coin data
   * @returns {number} - Risk score (0-100)
   */
  static calculateAgeRisk(coin) {
    // For now, we don't have creation date in our data
    // Can be implemented later when available
    // For now, use last_updated as a proxy - coins with recent updates
    // tend to be newer or more actively changing

    const now = Math.floor(Date.now() / 1000);
    const daysSinceUpdate = (now - (coin.last_updated || now)) / (60 * 60 * 24);

    // We're using a heuristic here - very recently updated coins
    // could be new or actively changing, both somewhat higher risk
    if (daysSinceUpdate < 1) return 60;
    if (daysSinceUpdate < 7) return 50;
    if (daysSinceUpdate < 30) return 40;
    if (daysSinceUpdate < 90) return 30;
    return 20;
  }

  /**
   * Calculate risk based on holder count changes
   * @param {Array} holderHistory - Historical holder data
   * @returns {number} - Risk score (0-100)
   */
  static calculateHolderChangeRisk(holderHistory) {
    if (holderHistory.length < 2) return 50; // Default with insufficient data

    try {
      // Sort by timestamp to ensure proper sequence
      const sortedHistory = holderHistory.sort((a, b) => a.timestamp - b.timestamp);

      // Calculate percentage changes between consecutive days
      const changes = [];
      for (let i = 1; i < sortedHistory.length; i++) {
        const prevValue = sortedHistory[i - 1].value;
        const currentValue = sortedHistory[i].value;
        if (prevValue > 0) {
          changes.push((currentValue - prevValue) / prevValue);
        }
      }

      if (changes.length === 0) return 50;

      // Calculate average daily change
      const avgChange = changes.reduce((sum, val) => sum + val, 0) / changes.length;

      // Look for abnormal spikes or drops
      const maxChange = Math.max(...changes.map((c) => Math.abs(c)));

      // Both rapid growth and rapid decline are risky
      // A change of 30% or more in holders in a single day is extremely unusual
      const spikeRisk = Math.min(100, Math.max(0, maxChange * 300));

      // Steady decline in holders is also a strong warning sign
      const trendRisk = avgChange < -0.01 ? 80 : avgChange < 0 ? 60 : 30;

      // Combine the risks (70% weight on spikes, 30% on trend)
      return spikeRisk * 0.7 + trendRisk * 0.3;
    } catch (error) {
      Logger.error('Error calculating holder change risk:', { error: error.message });
      return 50; // Default moderate risk on error
    }
  }
}

module.exports = RiskAnalyzer;
