/**
 * TrendAnalyzer provides lightweight time-series analysis
 * for pattern detection in historical metrics.
 */
const tf = require('@tensorflow/tfjs');
const Database = require('../database');
const CacheService = require('../services/cache');
const Logger = require('../services/logger');

class TrendAnalyzer {
  /**
   * Builds a model to analyze and predict holder growth trends
   * @param {string} contractAddress - Contract address of the coin
   * @returns {Object|null} - Prediction results or null if insufficient data
   */
  static async buildHolderGrowthModel(contractAddress) {
    try {
      // Check cache first
      const cacheKey = `trend_model_${contractAddress}`;
      return await CacheService.getOrFetch(
        cacheKey,
        async () => {
          // Get historical holder data from database
          const history = await Database.getHistoricalMetrics(contractAddress, 'holders', 14);

          // Need minimum data points to build meaningful model
          if (history.length < 7) {
            Logger.warn(
              `Insufficient data for trend analysis: ${contractAddress} (${history.length} points)`
            );
            return null;
          }

          // Log the data we're working with to validate
          Logger.debug(
            `Building trend model for ${contractAddress} with ${history.length} data points`
          );

          // Extract and normalize the values
          const values = history.map((h) => h.value);
          const timestamps = history.map((h) => h.timestamp);

          // Create a properly ordered time series (recent data might be out of order)
          const timeSeriesData = timestamps
            .map((ts, i) => ({ timestamp: ts, value: values[i] }))
            .sort((a, b) => a.timestamp - b.timestamp);

          const orderedValues = timeSeriesData.map((d) => d.value);

          // Skip model if there's no variance in the data (flat line)
          const min = Math.min(...orderedValues);
          const max = Math.max(...orderedValues);
          if (max - min < 0.00001) {
            return {
              predictions: Array(3).fill(orderedValues[orderedValues.length - 1]),
              growthRates: Array(3).fill(0),
              trendDirection: 'stable',
              confidence: 90,
            };
          }

          // Normalize data for the model
          const normalized = this.normalizeData(orderedValues);

          // Create tensor datasets
          const inputSize = 3; // Use last 3 points to predict next
          const tensorData = [];
          const tensorLabels = [];

          // Create sliding window datasets for training
          for (let i = 0; i < normalized.length - inputSize; i++) {
            const windowData = normalized.slice(i, i + inputSize);
            const label = normalized[i + inputSize];
            tensorData.push(windowData);
            tensorLabels.push([label]);
          }

          // Only train if we have enough sequences
          if (tensorData.length < 3) {
            Logger.warn(`Not enough sequences for training: ${contractAddress}`);
            return this.fallbackPrediction(orderedValues);
          }

          // Convert to tensor format
          const xs = tf.tensor2d(tensorData);
          const ys = tf.tensor2d(tensorLabels);

          // Build a simple neural network model for time series
          const model = tf.sequential();
          model.add(
            tf.layers.dense({
              units: 8,
              activation: 'relu',
              inputShape: [inputSize],
            })
          );
          model.add(
            tf.layers.dense({
              units: 1,
            })
          );

          // Compile the model
          model.compile({
            optimizer: tf.train.adam(0.01),
            loss: 'meanSquaredError',
          });

          // Train the model
          await model.fit(xs, ys, {
            epochs: 100,
            shuffle: true,
            verbose: 0,
          });

          // Generate predictions
          const lastWindow = normalized.slice(-inputSize);
          let predictions = [];
          let currentInput = [...lastWindow];

          // Predict next 3 days
          for (let i = 0; i < 3; i++) {
            const inputTensor = tf.tensor2d([currentInput]);
            const predTensor = model.predict(inputTensor);
            const predValue = predTensor.dataSync()[0];

            predictions.push(predValue);

            // Update window for next prediction (rolling window)
            currentInput.shift();
            currentInput.push(predValue);

            // Clean up tensors
            inputTensor.dispose();
            predTensor.dispose();
          }

          // Denormalize predictions
          const denormalizedPredictions = this.denormalizeData(predictions, orderedValues);

          // Calculate growth rates
          const lastActualValue = orderedValues[orderedValues.length - 1];
          const growthRates = denormalizedPredictions.map((val, i) => {
            const compareValue = i === 0 ? lastActualValue : denormalizedPredictions[i - 1];
            return ((val - compareValue) / compareValue) * 100;
          });

          // Determine confidence based on model loss and data variance
          const confidence = this.calculateConfidence(growthRates);

          // Clean up tensors
          xs.dispose();
          ys.dispose();

          // Return prediction results
          return {
            predictions: denormalizedPredictions,
            growthRates,
            trendDirection: this.determineTrendDirection(growthRates),
            confidence,
          };
        },
        3600
      ); // Cache for 1 hour
    } catch (error) {
      Logger.error('Error in trend analysis:', {
        error: error.message,
        contract: contractAddress,
        stack: error.stack,
      });
      return null;
    }
  }

  /**
   * Normalize data to 0-1 range
   * @param {Array} data - Array of numerical values
   * @returns {Array} - Normalized array
   */
  static normalizeData(data) {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;

    // Avoid division by zero
    if (range === 0) return data.map(() => 0.5);

    return data.map((val) => (val - min) / range);
  }

  /**
   * Denormalize data from 0-1 range back to original scale
   * @param {Array} normalizedData - Normalized data
   * @param {Array} originalData - Original data for reference
   * @returns {Array} - Denormalized data
   */
  static denormalizeData(normalizedData, originalData) {
    const min = Math.min(...originalData);
    const max = Math.max(...originalData);
    const range = max - min;

    return normalizedData.map((val) => val * range + min);
  }

  /**
   * Calculate confidence score based on growth rate consistency
   * @param {Array} growthRates - Predicted growth rates
   * @returns {number} - Confidence score (0-100)
   */
  static calculateConfidence(growthRates) {
    // More consistent growth rates = higher confidence
    const variations = growthRates
      .map((rate, i, arr) => (i === 0 ? 0 : Math.abs(rate - arr[i - 1])))
      .slice(1);

    // Calculate average variation
    const avgVariation = variations.reduce((sum, val) => sum + val, 0) / (variations.length || 1);

    // Scale to 0-100% (lower variation = higher confidence)
    // Cap variation at 10 (10% change between days)
    const normalizedVariation = Math.min(avgVariation, 10) / 10;
    const confidenceScore = 100 - normalizedVariation * 100;

    return Math.round(confidenceScore);
  }

  /**
   * Determine trend direction based on growth rates
   * @param {Array} growthRates - Predicted growth rates
   * @returns {string} - Trend direction (up/down/stable)
   */
  static determineTrendDirection(growthRates) {
    // Calculate average growth rate
    const avgGrowth = growthRates.reduce((sum, val) => sum + val, 0) / growthRates.length;

    if (avgGrowth > 0.5) return 'up';
    if (avgGrowth < -0.5) return 'down';
    return 'stable';
  }

  /**
   * Generate a simple fallback prediction when ML model can't be trained
   * @param {Array} values - Historical values
   * @returns {Object} - Simple prediction based on linear trend
   */
  static fallbackPrediction(values) {
    // Use linear regression for fallback
    if (values.length < 3) {
      return {
        predictions: Array(3).fill(values[values.length - 1]),
        growthRates: Array(3).fill(0),
        trendDirection: 'stable',
        confidence: 30,
      };
    }

    // Calculate recent trend (last 3 points)
    const recentValues = values.slice(-3);
    const recentGrowth = (recentValues[2] - recentValues[0]) / (recentValues[0] || 1);
    const dailyChange = recentGrowth / 2; // Approximation

    // Generate simple predictions
    const lastValue = values[values.length - 1];
    const predictions = [
      lastValue * (1 + dailyChange),
      lastValue * (1 + dailyChange * 2),
      lastValue * (1 + dailyChange * 3),
    ];

    // Calculate growth rates
    const growthRates = [dailyChange * 100, dailyChange * 100, dailyChange * 100];

    return {
      predictions,
      growthRates,
      trendDirection: dailyChange > 0 ? 'up' : dailyChange < 0 ? 'down' : 'stable',
      confidence: 40, // Lower confidence for fallback method
    };
  }
}

module.exports = TrendAnalyzer;
