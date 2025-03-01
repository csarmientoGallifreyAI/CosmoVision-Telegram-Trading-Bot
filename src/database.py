import sqlite3
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_PATH = os.getenv("DATABASE_PATH", "data/memecoins.db")

# Ensure the directory exists
os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)

def get_connection():
    """Get a connection to the SQLite database."""
    return sqlite3.connect(DATABASE_PATH)

def initialize_database():
    """Create the database tables if they don't exist."""
    conn = get_connection()
    cursor = conn.cursor()

    # Create coins table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS coins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        contract TEXT UNIQUE NOT NULL,
        price REAL,
        holders INTEGER,
        transfers_24h INTEGER,
        last_updated INTEGER
    )
    ''')

    conn.commit()
    conn.close()

def update_coin_data(coins):
    """Update or insert coin data from the scraper."""
    conn = get_connection()
    cursor = conn.cursor()

    for coin in coins:
        cursor.execute('''
        INSERT INTO coins (name, symbol, contract, price, last_updated)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(contract) DO UPDATE SET
        name = excluded.name,
        symbol = excluded.symbol,
        price = excluded.price,
        last_updated = excluded.last_updated
        ''', (coin['name'], coin['symbol'], coin['contract'], coin['price'], coin['last_updated']))

    conn.commit()
    conn.close()

def update_blockchain_metrics(contract, holders, transfers_24h, timestamp):
    """Update blockchain metrics for a specific coin."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('''
    UPDATE coins SET
    holders = ?,
    transfers_24h = ?,
    last_updated = ?
    WHERE contract = ?
    ''', (holders, transfers_24h, timestamp, contract))

    conn.commit()
    conn.close()

def get_all_contracts():
    """Get all contract addresses from the database."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT contract FROM coins')
    contracts = [row[0] for row in cursor.fetchall()]

    conn.close()
    return contracts

def search_coin(query):
    """Search for a coin by name or symbol."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('''
    SELECT name, symbol, contract, price, holders, transfers_24h, last_updated
    FROM coins
    WHERE name LIKE ? OR symbol LIKE ?
    ''', (f'%{query}%', f'%{query}%'))

    result = cursor.fetchone()
    conn.close()

    if result:
        return {
            'name': result[0],
            'symbol': result[1],
            'contract': result[2],
            'price': result[3],
            'holders': result[4],
            'transfers_24h': result[5],
            'last_updated': result[6]
        }

    return None