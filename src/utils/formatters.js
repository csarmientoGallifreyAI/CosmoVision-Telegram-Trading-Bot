/**
 * Formatting utilities for consistent display of data
 */

/**
 * Format a Unix timestamp to a readable date/time string
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Formatted date string
 */
const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'Never';

  const date = new Date(timestamp * 1000);
  return date.toISOString().replace('T', ' ').substring(0, 19);
};

/**
 * Format a number with thousands separators
 * @param {number} num - The number to format
 * @returns {string} Formatted number string
 */
const formatNumber = (num) => {
  if (num === null || num === undefined) return 'Unknown';
  return num.toLocaleString();
};

/**
 * Format a price with appropriate precision
 * @param {number} price - The price to format
 * @returns {string} Formatted price string
 */
const formatPrice = (price) => {
  if (price === null || price === undefined) return 'Unknown';

  // Handle different scales appropriately
  if (price < 0.00001) {
    return `$${price.toExponential(4)}`;
  } else if (price < 1) {
    return `$${price.toFixed(8)}`;
  } else {
    return `$${price.toFixed(2)}`;
  }
};

/**
 * Format a market cap value with appropriate scale (B, M, K)
 * @param {number} marketCap - The market cap value
 * @returns {string} Formatted market cap string
 */
const formatMarketCap = (marketCap) => {
  if (marketCap === null || marketCap === undefined) return 'Unknown';

  const tiers = [
    { threshold: 1_000_000_000, suffix: 'B' },
    { threshold: 1_000_000, suffix: 'M' },
    { threshold: 1_000, suffix: 'K' },
  ];

  for (const { threshold, suffix } of tiers) {
    if (marketCap >= threshold) {
      return `$${(marketCap / threshold).toFixed(2)}${suffix}`;
    }
  }

  return `$${marketCap.toFixed(2)}`;
};

/**
 * Get a change indicator with percentage for displaying trends
 * @param {number} oldValue - Previous value
 * @param {number} newValue - Current value
 * @returns {string} Change indicator with percentage
 */
const getChangeIndicator = (oldValue, newValue) => {
  if (oldValue === null || newValue === null || oldValue === 0) return '';

  const percentChange = ((newValue - oldValue) / oldValue) * 100;

  if (Math.abs(percentChange) < 0.5) return '→';
  if (percentChange > 0) return `↑ ${percentChange.toFixed(1)}%`;
  return `↓ ${Math.abs(percentChange).toFixed(1)}%`;
};

/**
 * Get an explorer link for a contract address based on chain
 * @param {string} contract - Contract address
 * @param {string} chain - Blockchain name
 * @returns {string} Markdown formatted link to block explorer
 */
const getExplorerLink = (contract, chain) => {
  if (chain === 'BSC') {
    return `[BscScan](https://bscscan.com/token/${contract})`;
  } else if (chain === 'NEAR') {
    return `[NEAR Explorer](https://explorer.near.org/accounts/${contract})`;
  }
  // Default to Ethereum
  return `[Etherscan](https://etherscan.io/token/${contract})`;
};

module.exports = {
  formatTimestamp,
  formatNumber,
  formatPrice,
  formatMarketCap,
  getChangeIndicator,
  getExplorerLink,
};
