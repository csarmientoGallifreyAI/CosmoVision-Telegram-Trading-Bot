import requests
import time
import logging
import os
import sys
from dotenv import load_dotenv

# Add the parent directory to the path to make imports work from any directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Now we can import our modules
try:
    # Try importing with the src prefix first (when running as a module)
    from src.database import get_all_contracts, update_blockchain_metrics
except ModuleNotFoundError:
    # Fall back to direct imports (when running the script directly)
    from database import get_all_contracts, update_blockchain_metrics

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

BSCSCAN_API_KEY = os.getenv("BSCSCAN_API_KEY")
BSCSCAN_BASE_URL = "https://api.bscscan.com/api"
REQUEST_DELAY = 0.25  # 250ms delay between requests to avoid rate limits

def fetch_holders_count(contract_address):
    """
    Fetch the number of token holders for a contract.

    Args:
        contract_address (str): The contract address to query.

    Returns:
        int: The number of token holders, or 0 if the request fails.
    """
    try:
        # Unfortunately, BscScan API doesn't provide a direct endpoint for holder count
        # We'll need to fetch the token info and parse it, or use alternative approaches

        # For demo purposes, we'll use a workaround: getting a sample of holders and estimating
        params = {
            'module': 'token',
            'action': 'tokenholderlist',
            'contractaddress': contract_address,
            'page': 1,
            'offset': 10,  # Request only a small number to stay within rate limits
            'apikey': BSCSCAN_API_KEY
        }

        logger.info(f"Fetching holders for contract: {contract_address[:8]}...")
        response = requests.get(BSCSCAN_BASE_URL, params=params, timeout=10)
        data = response.json()

        if data['status'] == '1':
            # If successful, return the total count if provided, or just the count of returned holders
            if 'countTokenHolders' in data:
                holders_count = int(data['countTokenHolders'])
            else:
                # Otherwise, just count the returned holders (less accurate)
                holders_count = len(data['result'])

            logger.info(f"Contract {contract_address[:8]} has {holders_count} holders")
            return holders_count
        else:
            logger.warning(f"Failed to get holders for {contract_address[:8]}: {data.get('message', 'Unknown error')}")
            return 0

    except Exception as e:
        logger.error(f"Error fetching holders for {contract_address[:8]}: {e}")
        return 0

def fetch_transfers_24h(contract_address):
    """
    Fetch and count token transfers in the last 24 hours.

    Args:
        contract_address (str): The contract address to query.

    Returns:
        int: The number of transfers in the last 24 hours, or 0 if the request fails.
    """
    try:
        # Calculate timestamp for 24 hours ago
        timestamp_24h_ago = int(time.time()) - 86400

        params = {
            'module': 'account',
            'action': 'tokentx',
            'contractaddress': contract_address,
            'startblock': 0,
            'endblock': 99999999,
            'sort': 'desc',
            'apikey': BSCSCAN_API_KEY
        }

        logger.info(f"Fetching recent transfers for contract: {contract_address[:8]}...")
        response = requests.get(BSCSCAN_BASE_URL, params=params, timeout=10)
        data = response.json()

        if data['status'] == '1':
            # Count transfers in the last 24 hours
            transfers_24h = sum(1 for tx in data['result'] if int(tx['timeStamp']) > timestamp_24h_ago)
            logger.info(f"Contract {contract_address[:8]} has {transfers_24h} transfers in the last 24 hours")
            return transfers_24h
        else:
            logger.warning(f"Failed to get transfers for {contract_address[:8]}: {data.get('message', 'Unknown error')}")
            return 0

    except Exception as e:
        logger.error(f"Error fetching transfers for {contract_address[:8]}: {e}")
        return 0

def update_blockchain_data():
    """Update blockchain data for all contracts in the database."""
    logger.info("Starting blockchain data update...")

    contracts = get_all_contracts()

    if not contracts:
        logger.warning("No contracts found in the database. Skipping blockchain data update.")
        return

    logger.info(f"Found {len(contracts)} contracts to update")

    for contract in contracts:
        try:
            # Fetch data from BscScan
            holders = fetch_holders_count(contract)
            time.sleep(REQUEST_DELAY)  # Avoid rate limits

            transfers = fetch_transfers_24h(contract)
            time.sleep(REQUEST_DELAY)  # Avoid rate limits

            # Update database
            current_timestamp = int(time.time())
            update_blockchain_metrics(contract, holders, transfers, current_timestamp)

            logger.info(f"Updated metrics for {contract[:8]}: {holders} holders, {transfers} recent transfers")

        except Exception as e:
            logger.error(f"Error updating blockchain data for {contract[:8]}: {e}")
            continue

    logger.info("Blockchain data update completed")

if __name__ == "__main__":
    update_blockchain_data()