/**
 * API fallback handler
 * This endpoint should only be hit if the Vercel routing isn't working correctly
 */
module.exports = (req, res) => {
  res.status(200).json({
    message:
      'CosmoVision API is running, but you should be seeing the dashboard. Check your Vercel configuration.',
    dashboardRoute: '/',
    apiPrefix: '/api',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
};
