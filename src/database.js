const sqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Database configuration
// Check if running on Vercel (production environment)
const isVercel = process.env.VERCEL === '1';
// Use /tmp directory on Vercel, otherwise use the regular path
const DB_DIRECTORY = isVercel ? '/tmp' : path.join(process.cwd(), 'src', 'data');
const DB_PATH = path.join(DB_DIRECTORY, 'coins.db');

// Database class to handle all SQLite operations
class Database {
  static db = null;

  static initialize_database() {
    console.log('Initializing database...');
    console.log(`Database path: ${DB_PATH}`);

    // Create data directory if it doesn't exist
    if (!fs.existsSync(DB_DIRECTORY)) {
      console.log(`Creating database directory: ${DB_DIRECTORY}`);
      fs.mkdirSync(DB_DIRECTORY, { recursive: true });
    }

    try {
      this.db = new sqlite3(DB_PATH);

      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');

      // Create tables if they don't exist
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS coins (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          symbol TEXT NOT NULL,
          contract TEXT UNIQUE,
          price REAL,
          holders INTEGER,
          transfers_24h INTEGER,
          last_updated INTEGER,
          UNIQUE(name, symbol)
        );
      `);

      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  static close_connection() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  static async upsert_coin(coin_data) {
    try {
      if (!this.db) {
        this.initialize_database();
      }

      const stmt = this.db.prepare(`
        INSERT INTO coins (
          name, symbol, contract, price, holders, transfers_24h, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(contract) DO UPDATE SET
          name = excluded.name,
          symbol = excluded.symbol,
          price = excluded.price,
          holders = excluded.holders,
          transfers_24h = excluded.transfers_24h,
          last_updated = excluded.last_updated
      `);

      const result = stmt.run(
        coin_data.name,
        coin_data.symbol,
        coin_data.contract,
        coin_data.price,
        coin_data.holders,
        coin_data.transfers_24h,
        Math.floor(Date.now() / 1000) // Current timestamp in seconds
      );

      return result.changes > 0;
    } catch (error) {
      console.error('Error upserting coin:', error);
      throw error;
    }
  }

  static async search_coin(query) {
    try {
      if (!this.db) {
        this.initialize_database();
      }

      query = query.trim().toLowerCase();

      const stmt = this.db.prepare(`
        SELECT * FROM coins
        WHERE LOWER(name) LIKE ?
        OR LOWER(symbol) LIKE ?
        OR LOWER(contract) LIKE ?
        LIMIT 1
      `);

      const coin = stmt.get(`%${query}%`, `%${query}%`, `%${query}%`);

      return coin || null;
    } catch (error) {
      console.error('Error searching for coin:', error);
      throw error;
    }
  }

  static async get_all_coins() {
    try {
      if (!this.db) {
        this.initialize_database();
      }

      const stmt = this.db.prepare('SELECT * FROM coins');
      return stmt.all();
    } catch (error) {
      console.error('Error getting all coins:', error);
      throw error;
    }
  }
}

module.exports = Database;
