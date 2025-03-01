const sqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const Logger = require('./services/logger');

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
    Logger.info('Initializing database...');
    Logger.debug(`Database path: ${DB_PATH}`);

    // Create data directory if it doesn't exist
    if (!fs.existsSync(DB_DIRECTORY)) {
      Logger.info(`Creating database directory: ${DB_DIRECTORY}`);
      fs.mkdirSync(DB_DIRECTORY, { recursive: true });
    }

    try {
      this.db = new sqlite3(DB_PATH);

      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');

      // Get existing table schema
      const tableInfo = this.db.prepare('PRAGMA table_info(coins)').all();
      const columns = tableInfo.map((col) => col.name);

      // Create the main coins table if it doesn't exist
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

      // Add new columns if they don't exist
      if (!columns.includes('market_cap')) {
        Logger.info('Adding market_cap column to coins table');
        this.db.exec('ALTER TABLE coins ADD COLUMN market_cap REAL DEFAULT NULL;');
      }

      if (!columns.includes('chain')) {
        Logger.info('Adding chain column to coins table');
        this.db.exec('ALTER TABLE coins ADD COLUMN chain TEXT DEFAULT "BSC";');

        // Add index for chain column
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_coins_chain ON coins(chain);');
      }

      // Create historical metrics table for time-series analysis
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS historical_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contract TEXT NOT NULL,
          metric_name TEXT NOT NULL,
          value REAL NOT NULL,
          timestamp INTEGER NOT NULL,
          FOREIGN KEY (contract) REFERENCES coins(contract) ON DELETE CASCADE,
          UNIQUE(contract, metric_name, timestamp)
        );
      `);

      // Create indices for historical_metrics
      this.db.exec(
        'CREATE INDEX IF NOT EXISTS idx_historical_contract ON historical_metrics(contract);'
      );
      this.db.exec(
        'CREATE INDEX IF NOT EXISTS idx_historical_metric ON historical_metrics(metric_name);'
      );
      this.db.exec(
        'CREATE INDEX IF NOT EXISTS idx_historical_timestamp ON historical_metrics(timestamp);'
      );

      // Create coin embeddings table for similarity search
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS coin_embeddings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contract TEXT NOT NULL,
          embedding BLOB NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (contract) REFERENCES coins(contract) ON DELETE CASCADE,
          UNIQUE(contract)
        );
      `);

      Logger.info('Database initialized successfully');
    } catch (error) {
      Logger.error('Error initializing database:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  static close_connection() {
    if (this.db) {
      this.db.close();
      this.db = null;
      Logger.debug('Database connection closed');
    }
  }

  static async upsert_coin(coin_data) {
    try {
      if (!this.db) {
        this.initialize_database();
      }

      // Extract fields from coin_data
      const { name, symbol, contract, price, holders, transfers_24h, market_cap, chain } =
        coin_data;

      // Prepare the SQL query
      let sql;
      let params;

      // Check if the chain field is provided
      if (chain !== undefined) {
        sql = `
          INSERT INTO coins (
            name, symbol, contract, price, holders, transfers_24h, market_cap, chain, last_updated
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(contract) DO UPDATE SET
            name = excluded.name,
            symbol = excluded.symbol,
            price = excluded.price,
            holders = excluded.holders,
            transfers_24h = excluded.transfers_24h,
            market_cap = excluded.market_cap,
            chain = excluded.chain,
            last_updated = excluded.last_updated
        `;
        params = [
          name,
          symbol,
          contract,
          price,
          holders,
          transfers_24h,
          market_cap,
          chain,
          Math.floor(Date.now() / 1000), // Current timestamp in seconds
        ];
      } else {
        // Legacy support for old code without chain parameter
        sql = `
          INSERT INTO coins (
            name, symbol, contract, price, holders, transfers_24h, market_cap, last_updated
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(contract) DO UPDATE SET
            name = excluded.name,
            symbol = excluded.symbol,
            price = excluded.price,
            holders = excluded.holders,
            transfers_24h = excluded.transfers_24h,
            market_cap = excluded.market_cap,
            last_updated = excluded.last_updated
        `;
        params = [
          name,
          symbol,
          contract,
          price,
          holders,
          transfers_24h,
          market_cap,
          Math.floor(Date.now() / 1000), // Current timestamp in seconds
        ];
      }

      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);

      Logger.debug(`Upserted coin: ${name} (${symbol})`);
      return result.changes > 0;
    } catch (error) {
      Logger.error('Error upserting coin:', { coin: coin_data.name, error: error.message });
      throw error;
    }
  }

  static async updateCoinMarketCap(contract, marketCap) {
    try {
      if (!this.db) {
        this.initialize_database();
      }

      const stmt = this.db.prepare(`
        UPDATE coins SET market_cap = ? WHERE contract = ?
      `);

      const result = stmt.run(marketCap, contract);

      Logger.debug(`Updated market cap for contract: ${contract}`);
      return result.changes > 0;
    } catch (error) {
      Logger.error('Error updating market cap:', { contract, error: error.message });
      throw error;
    }
  }

  static async search_coin(query) {
    try {
      if (!this.db) {
        this.initialize_database();
      }

      query = query.trim().toLowerCase();

      Logger.debug(`Searching for coin with query: ${query}`);

      const stmt = this.db.prepare(`
        SELECT * FROM coins
        WHERE LOWER(name) LIKE ?
        OR LOWER(symbol) LIKE ?
        OR LOWER(contract) LIKE ?
        LIMIT 1
      `);

      const coin = stmt.get(`%${query}%`, `%${query}%`, `%${query}%`);

      if (coin) {
        Logger.debug(`Found coin: ${coin.name} (${coin.symbol})`);
      } else {
        Logger.debug(`No coin found for query: ${query}`);
      }

      return coin || null;
    } catch (error) {
      Logger.error('Error searching for coin:', { query, error: error.message });
      throw error;
    }
  }

  static async get_all_coins() {
    try {
      if (!this.db) {
        this.initialize_database();
      }

      Logger.debug('Fetching all coins from database');
      const stmt = this.db.prepare('SELECT * FROM coins');
      const coins = stmt.all();

      Logger.debug(`Retrieved ${coins.length} coins from database`);
      return coins;
    } catch (error) {
      Logger.error('Error getting all coins:', { error: error.message });
      throw error;
    }
  }

  static async get_historical_data(contract, period = 'daily', limit = 7) {
    try {
      if (!this.db) {
        this.initialize_database();
      }

      // Check if the history table exists, create if not
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS coin_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contract TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          price REAL,
          holders INTEGER,
          transfers_24h INTEGER,
          market_cap REAL,
          UNIQUE(contract, timestamp),
          FOREIGN KEY (contract) REFERENCES coins(contract)
        );
        CREATE INDEX IF NOT EXISTS idx_history_contract_time ON coin_history(contract, timestamp);
      `);

      Logger.debug(`Fetching ${period} historical data for ${contract}, limit ${limit}`);

      const stmt = this.db.prepare(`
        SELECT * FROM coin_history
        WHERE contract = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `);

      const history = stmt.all(contract, limit);

      Logger.debug(`Retrieved ${history.length} historical data points for ${contract}`);
      return history;
    } catch (error) {
      Logger.error('Error getting historical data:', { contract, error: error.message });
      return [];
    }
  }

  static async save_historical_snapshot() {
    try {
      if (!this.db) {
        this.initialize_database();
      }

      // Create history table if not exists
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS coin_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contract TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          price REAL,
          holders INTEGER,
          transfers_24h INTEGER,
          market_cap REAL,
          UNIQUE(contract, timestamp),
          FOREIGN KEY (contract) REFERENCES coins(contract)
        );
        CREATE INDEX IF NOT EXISTS idx_history_contract_time ON coin_history(contract, timestamp);
      `);

      // Get all current coins
      const coins = this.db.prepare('SELECT * FROM coins').all();

      if (!coins || coins.length === 0) {
        Logger.info('No coins to snapshot for historical data');
        return 0;
      }

      Logger.info(`Creating historical snapshot for ${coins.length} coins`);

      // Current timestamp
      const now = Math.floor(Date.now() / 1000);

      // Insert each coin's current state into history
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO coin_history (
          contract, timestamp, price, holders, transfers_24h, market_cap
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      let count = 0;
      for (const coin of coins) {
        try {
          stmt.run(
            coin.contract,
            now,
            coin.price,
            coin.holders,
            coin.transfers_24h,
            coin.market_cap
          );
          count++;
        } catch (insertError) {
          Logger.error('Error inserting coin history:', {
            contract: coin.contract,
            error: insertError.message,
          });
        }
      }

      Logger.info(`Successfully saved historical snapshot for ${count} coins`);
      return count;
    } catch (error) {
      Logger.error('Error saving historical snapshot:', { error: error.message });
      throw error;
    }
  }

  static async getHistoricalMetrics(contract, metricName, days = 14) {
    try {
      if (!this.db) {
        this.initialize_database();
      }

      const stmt = this.db.prepare(`
        SELECT value, timestamp
        FROM historical_metrics
        WHERE contract = ? AND metric_name = ?
        AND timestamp >= ?
        ORDER BY timestamp ASC
      `);

      const cutoffTime = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
      const rows = stmt.all(contract, metricName, cutoffTime);

      return rows;
    } catch (error) {
      Logger.error('Error fetching historical metrics:', {
        error: error.message,
        contract,
        metricName,
      });
      return [];
    }
  }

  static async saveHistoricalMetric(contract, metricName, value) {
    try {
      if (!this.db) {
        this.initialize_database();
      }

      const timestamp = Math.floor(Date.now() / 1000);

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO historical_metrics (contract, metric_name, value, timestamp)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(contract, metricName, value, timestamp);
      Logger.debug(`Saved historical metric: ${metricName} for ${contract}`);

      return true;
    } catch (error) {
      Logger.error('Error saving historical metric:', {
        error: error.message,
        contract,
        metricName,
      });
      return false;
    }
  }

  static async saveEmbedding(contract, embedding) {
    try {
      if (!this.db) {
        this.initialize_database();
      }

      // Convert the embedding array to a binary blob
      const embeddingBlob = Buffer.from(JSON.stringify(embedding));
      const timestamp = Math.floor(Date.now() / 1000);

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO coin_embeddings (contract, embedding, created_at)
        VALUES (?, ?, ?)
      `);

      stmt.run(contract, embeddingBlob, timestamp);
      Logger.debug(`Saved embedding for ${contract}`);

      return true;
    } catch (error) {
      Logger.error('Error saving embedding:', { error: error.message, contract });
      return false;
    }
  }

  static async getEmbedding(contract) {
    try {
      if (!this.db) {
        this.initialize_database();
      }

      const stmt = this.db.prepare(`
        SELECT embedding FROM coin_embeddings
        WHERE contract = ?
      `);

      const row = stmt.get(contract);

      if (!row) return null;

      // Convert the blob back to a JavaScript array
      return JSON.parse(row.embedding.toString());
    } catch (error) {
      Logger.error('Error fetching embedding:', { error: error.message, contract });
      return null;
    }
  }

  static async getAllEmbeddings() {
    try {
      if (!this.db) {
        this.initialize_database();
      }

      const stmt = this.db.prepare(`
        SELECT e.contract, e.embedding, c.name, c.symbol
        FROM coin_embeddings e
        JOIN coins c ON e.contract = c.contract
      `);

      const rows = stmt.all();

      return rows.map((row) => ({
        contract: row.contract,
        name: row.name,
        symbol: row.symbol,
        embedding: JSON.parse(row.embedding.toString()),
      }));
    } catch (error) {
      Logger.error('Error fetching all embeddings:', { error: error.message });
      return [];
    }
  }
}

module.exports = Database;
