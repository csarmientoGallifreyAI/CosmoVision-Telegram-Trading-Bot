import requests
from bs4 import BeautifulSoup
import time
import logging
import os
import sys
from dotenv import load_dotenv
import random

# Add the parent directory to the path to make imports work from any directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Now we can import our modules
try:
    # Try importing with the src prefix first (when running as a module)
    from src.database import update_coin_data
except ModuleNotFoundError:
    # Fall back to direct imports (when running the script directly)
    from database import update_coin_data

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def scrape_grafun():
    """
    Scrape meme coin data from gra.fun website.

    Returns:
        list: List of coin dictionaries with name, symbol, contract, price, and timestamp.
    """
    logger.info("Starting to scrape gra.fun...")

    try:
        # Add a user agent to mimic a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        # Primary URL for BSC meme coins (this would need to be updated based on actual website structure)
        url = "https://gra.fun/coins"

        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()  # Raise exception for 4XX/5XX status codes

        soup = BeautifulSoup(response.text, 'lxml')
        coins = []
        current_timestamp = int(time.time())

        # Log the fact that we're experimenting with selectors
        logger.info("Attempting to parse coin data with experimental selectors")

        # Note: The following selectors are speculative and would need adjustment
        # based on the actual structure of gra.fun
        coin_elements = soup.find_all('div', class_='coin-card')  # This selector needs adjustment

        if not coin_elements:
            # Try alternative selectors if the first attempt fails
            logger.info("First selector failed, trying alternative selectors")
            coin_elements = soup.find_all('tr', class_='coin-row')  # Alternative selector

        if not coin_elements:
            # If still no elements, try a more generic approach
            logger.info("Second selector failed, trying broader approach")
            # Look for any table rows that might contain coin data
            coin_elements = soup.find_all('tr')
            # Filter out rows that don't seem to contain coin data
            coin_elements = [e for e in coin_elements if e.find('a') and 'contract' in str(e).lower()]

        if not coin_elements:
            # If still unsuccessful, log the HTML for debugging
            logger.warning("Could not find coin elements. HTML structure may have changed.")
            logger.debug(f"Page HTML: {soup.prettify()[:500]}...")  # First 500 chars for debugging
            return []

        logger.info(f"Found {len(coin_elements)} potential coin elements")

        # Process each coin element
        for element in coin_elements:
            try:
                # The following extractions would need adjustment based on actual HTML structure
                name_element = element.find('span', class_='coin-name') or element.find('td', class_='name')
                symbol_element = element.find('span', class_='coin-symbol') or element.find('td', class_='symbol')
                contract_element = element.find('a', href=lambda x: x and 'bscscan.com' in x) or element.find('td', class_='contract').find('a')
                price_element = element.find('span', class_='coin-price') or element.find('td', class_='price')

                # Extract values, handling potential missing elements
                name = name_element.text.strip() if name_element else "Unknown"
                symbol = symbol_element.text.strip() if symbol_element else "UNK"

                # For contract address, extract from href or text
                if contract_element:
                    if contract_element.has_attr('href'):
                        # Extract contract from URL
                        href = contract_element['href']
                        # Assuming URL format like "https://bscscan.com/token/0x123456789..."
                        contract = href.split('/')[-1] if '/' in href else href
                    else:
                        contract = contract_element.text.strip()
                else:
                    contract = "0x0000000000000000000000000000000000000000"  # Default

                # For price, clean and convert to float
                if price_element:
                    price_text = price_element.text.strip().replace('$', '').replace(',', '')
                    price = float(price_text) if price_text and price_text.replace('.', '').isdigit() else 0.0
                else:
                    price = 0.0

                # Only include BSC tokens (those starting with 0x)
                if contract.startswith('0x'):
                    coins.append({
                        'name': name,
                        'symbol': symbol,
                        'contract': contract,
                        'price': price,
                        'last_updated': current_timestamp
                    })
            except Exception as e:
                logger.error(f"Error processing coin element: {e}")
                continue

        logger.info(f"Successfully scraped {len(coins)} BSC meme coins")
        return coins

    except requests.RequestException as e:
        logger.error(f"Request error during scraping: {e}")
        return []
    except Exception as e:
        logger.error(f"Unexpected error during scraping: {e}")
        return []

def run_scraper():
    """Run the scraper and update the database."""
    logger.info("Starting scraper run")
    coins = scrape_grafun()

    if coins:
        update_coin_data(coins)
        logger.info(f"Updated database with {len(coins)} coins")
    else:
        logger.warning("No coins were scraped in this run")

    logger.info("Scraper run completed")

if __name__ == "__main__":
    run_scraper()