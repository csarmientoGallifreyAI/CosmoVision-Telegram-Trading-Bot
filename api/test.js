module.exports = async (req, res) => {
  const timestamp = new Date().toISOString();

  // Return basic info
  return res.status(200).json({
    status: 'ok',
    message: 'The API is working correctly',
    timestamp,
    env: {
      node_env: process.env.NODE_ENV || 'development',
      bot_token_set: process.env.TELEGRAM_BOT_TOKEN ? true : false,
      etherscan_api_key_set: process.env.ETHERSCAN_API_KEY ? true : false,
    },
  });
};
