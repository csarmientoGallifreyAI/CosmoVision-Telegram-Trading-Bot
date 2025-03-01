// Create an api/index.js file
module.exports = (req, res) => {
  res.status(200).send(`
    <html>
      <head>
        <title>Cosmovision Telegram Bot</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; line-height: 1.6; }
          .container { max-width: 700px; margin: 0 auto; }
          h1 { border-bottom: 1px solid #eaeaea; margin-top: 0; padding-bottom: 10px; }
          a { color: #0070f3; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .api-link { background: #f0f0f0; padding: 10px; border-radius: 5px; margin: 20px 0; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Cosmovision Telegram Bot</h1>
          <p>This is the server for the Cosmovision Telegram Bot. The bot is running and ready to receive commands.</p>

          <p>Test the API status: <a class="api-link" href="/api/test">/api/test</a></p>

          <h2>How to use the bot:</h2>
          <ol>
            <li>Find the bot on Telegram</li>
            <li>Start a conversation with /start</li>
            <li>Use /analyze [coin name] to get information about a coin</li>
          </ol>
        </div>
      </body>
    </html>
  `);
};
