/**
 * Handler for the /help command
 * Provides information about all available commands
 */
async function helpHandler(ctx) {
  const commands = [
    {
      command: '/start',
      description: 'Register and start using the bot',
    },
    {
      command: '/help',
      description: 'Show this help message',
    },
    {
      command: '/ai',
      description: 'Ask questions to the AI assistant',
    },
    {
      command: '/trade',
      description: 'Access trading features and signals',
    },
    {
      command: '/signals',
      description: 'Get the latest trading signals',
    },
    {
      command: '/mytrades',
      description: 'View your saved trades and performance',
    },
    {
      command: '/predict',
      description: 'Get price predictions for meme coins',
    },
    {
      command: '/sentiment',
      description: 'Analyze sentiment for a coin',
    },
    {
      command: '/coins',
      description: 'List available coins and their stats',
    },
    {
      command: '/dashboard',
      description: 'Access your trading dashboard web interface',
    },
  ];

  let helpMessage = '*🤖 CosmoVision Trading Bot Commands:*\n\n';

  commands.forEach((command) => {
    helpMessage += `• ${command.command}: ${command.description}\n`;
  });

  // Add dashboard section
  helpMessage += '\n*📊 Trading Dashboard*\n';
  helpMessage +=
    'Use /dashboard to get a login code for our web dashboard interface, where you can:';
  helpMessage += '\n• Track trading signals and market data in real-time';
  helpMessage += '\n• View detailed performance analytics and charts';
  helpMessage += '\n• Manage your trades and settings with a user-friendly interface';
  helpMessage += '\n• Get insights and optimization tips for your trading strategy';

  // Add AI features section
  helpMessage += '\n\n*🧠 AI Capabilities*\n';
  helpMessage += 'Our bot includes powerful AI features:';
  helpMessage += '\n• Ask questions about crypto, trading, or any topic';
  helpMessage += '\n• Analyze market sentiment and trends';
  helpMessage += '\n• Get price predictions based on technical analysis';
  helpMessage += '\n• Receive personalized trading recommendations';

  // Add footer with information
  helpMessage += '\n\n*Powered by CosmoVision AI*';
  helpMessage += '\nRemember: All trading signals are for informational purposes only.';
  helpMessage += '\nLagrimas de zurdo 😎';

  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
}

// Command registration information
module.exports = {
  name: 'help',
  description: 'Get help and list of commands',
  handler: helpHandler,
};
