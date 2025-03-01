import logging
import os
import sys
import time
from datetime import datetime
from telegram import Update
from telegram.ext import Updater, CommandHandler, CallbackContext
from dotenv import load_dotenv

# Add the parent directory to the path to make imports work from any directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Now we can import our modules
try:
    # Try importing with the src prefix first (when running as a module)
    from src.database import search_coin
except ModuleNotFoundError:
    # Fall back to direct imports (when running the script directly)
    from database import search_coin

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Get Telegram Bot Token from environment variables
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

def format_timestamp(timestamp):
    """Format unix timestamp to human-readable date/time."""
    if not timestamp:
        return "Never"
    return datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')

def format_number(num):
    """Format number with commas for thousands separator."""
    if num is None:
        return "Unknown"
    return f"{num:,}"

def start(update: Update, context: CallbackContext) -> None:
    """Send a welcome message when the command /start is issued."""
    user = update.effective_user
    update.message.reply_text(
        f"Hello {user.first_name}! Welcome to the Meme Coin Analysis Bot.\n\n"
        f"Use /analyze <coin_name> or /analyze <symbol> to get metrics for a specific coin.\n\n"
        f"Example: /analyze DOGE"
    )

def help_command(update: Update, context: CallbackContext) -> None:
    """Send a help message when the command /help is issued."""
    update.message.reply_text(
        "Meme Coin Analysis Bot Commands:\n\n"
        "/analyze <coin_name> - Get analysis for a specific coin\n"
        "/help - Show this help message\n"
        "/start - Start the bot"
    )

def analyze_coin(update: Update, context: CallbackContext) -> None:
    """Analyze a coin by name or symbol."""
    if not context.args:
        update.message.reply_text("Please provide a coin name or symbol.\nExample: /analyze DOGE")
        return

    query = ' '.join(context.args)
    logger.info(f"User {update.effective_user.id} searching for coin: {query}")

    # Log the query for debugging
    logger.info(f"Searching for coin with query: {query}")

    # Search for the coin in the database
    coin = search_coin(query)

    if coin:
        # Format response
        response = (
            f"🪙 *{coin['name']}* ({coin['symbol']})\n\n"
            f"💰 *Price:* ${coin['price']:.8f}\n"
            f"👥 *Holders:* {format_number(coin['holders'])}\n"
            f"📊 *Transfers (24h):* {format_number(coin['transfers_24h'])}\n\n"
            f"📝 *Contract:* `{coin['contract']}`\n"
            f"🕒 *Last Updated:* {format_timestamp(coin['last_updated'])}"
        )

        # Add notes/analysis section
        if coin['holders'] and coin['transfers_24h']:
            activity_ratio = coin['transfers_24h'] / coin['holders'] if coin['holders'] > 0 else 0
            response += f"\n\n📈 *Activity Ratio:* {activity_ratio:.4f} transfers per holder in 24h"

            # Add simple analysis
            if activity_ratio > 0.5:
                response += "\n⚠️ *High activity ratio* - Could indicate significant trading or distribution"
            elif activity_ratio < 0.05:
                response += "\n⚠️ *Low activity ratio* - May suggest low trading interest"

        # Send response with Markdown formatting
        update.message.reply_text(response, parse_mode='Markdown')
        logger.info(f"Sent analysis for {coin['name']} to user {update.effective_user.id}")
    else:
        update.message.reply_text(f"Could not find a coin matching '{query}'. Try a different name or symbol.")
        logger.info(f"No coin found for query: {query}")

def error_handler(update: Update, context: CallbackContext) -> None:
    """Log errors caused by updates."""
    logger.error(f"Error occurred: {context.error} for update {update}")

    # Notify user about the error
    if update and update.effective_message:
        update.effective_message.reply_text("Sorry, an error occurred while processing your request.")

def run_bot():
    """Start the Telegram bot."""
    if not TELEGRAM_BOT_TOKEN:
        logger.error("Telegram bot token not found in environment variables!")
        return

    logger.info("Starting Telegram bot...")

    # Create the Updater and dispatcher
    updater = Updater(TELEGRAM_BOT_TOKEN)
    dispatcher = updater.dispatcher

    # Register command handlers
    dispatcher.add_handler(CommandHandler("start", start))
    dispatcher.add_handler(CommandHandler("help", help_command))
    dispatcher.add_handler(CommandHandler("analyze", analyze_coin))

    # Register error handler
    dispatcher.add_error_handler(error_handler)

    # Start the Bot
    updater.start_polling()
    logger.info("Bot started successfully")

    # Run the bot until the user presses Ctrl-C
    updater.idle()

if __name__ == "__main__":
    run_bot()