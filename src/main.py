import os
import time
import logging
import threading
import schedule
import sys
import argparse
from dotenv import load_dotenv

# Add the parent directory to the path to make imports work from any directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Now we can import our modules
try:
    # Try importing with the src prefix first (when running as a module)
    from src.database import initialize_database
    from src.scraper import run_scraper
    from src.blockchain import update_blockchain_data
    from src.telegram_bot import run_bot
except ModuleNotFoundError:
    # Fall back to direct imports (when running the script directly)
    from database import initialize_database
    from scraper import run_scraper
    from blockchain import update_blockchain_data
    from telegram_bot import run_bot

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Get configuration from environment variables
SCRAPE_INTERVAL = int(os.getenv("SCRAPE_INTERVAL", "3600"))  # Default: 1 hour
BSC_DATA_FETCH_INTERVAL = int(os.getenv("BSC_DATA_FETCH_INTERVAL", "3600"))  # Default: 1 hour

def scheduler_thread():
    """Run scheduled tasks in a separate thread."""
    logger.info("Starting scheduler thread...")

    # Schedule scraper to run periodically
    schedule.every(SCRAPE_INTERVAL).seconds.do(run_scraper)
    logger.info(f"Scheduled scraper to run every {SCRAPE_INTERVAL} seconds")

    # Schedule blockchain data fetcher to run periodically
    schedule.every(BSC_DATA_FETCH_INTERVAL).seconds.do(update_blockchain_data)
    logger.info(f"Scheduled blockchain data fetcher to run every {BSC_DATA_FETCH_INTERVAL} seconds")

    # Run the scraper and blockchain data fetcher once at startup
    logger.info("Running initial data collection...")
    run_scraper()
    update_blockchain_data()

    # Keep running the scheduled tasks
    while True:
        schedule.run_pending()
        time.sleep(1)

def main():
    """Main entry point of the application."""
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Meme Coin Analysis Telegram Bot')
    parser.add_argument('--test', action='store_true', help='Run in test mode (don\'t start the bot)')
    args = parser.parse_args()

    logger.info("Starting Meme Coin Analysis Bot...")

    # Initialize the database
    initialize_database()
    logger.info("Database initialized")

    # Start the scheduler in a separate thread
    scheduler = threading.Thread(target=scheduler_thread)
    scheduler.daemon = True  # This thread will exit when the main thread exits
    scheduler.start()
    logger.info("Scheduler thread started")

    # Start the Telegram bot in the main thread, unless test mode is enabled
    if not args.test:
        run_bot()
    else:
        logger.info("Running in test mode, skipping bot initialization")
        # Give the scheduler a moment to start initial data collection
        time.sleep(1)

    logger.info("Application shutting down...")

if __name__ == "__main__":
    main()