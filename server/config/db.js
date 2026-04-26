const mongoose = require('mongoose');

/**
 * DatabaseConnection — Singleton Pattern.
 *
 * Ensures only one MongoDB connection pool exists per process.
 * This is critical in a WebSocket server where many concurrent
 * connections could accidentally spawn duplicate DB pools.
 *
 * SOLID Principles:
 *   - Single Responsibility: Only manages database connectivity.
 *   - Open/Closed: Connection logic is encapsulated; new DB features
 *     (e.g. replica set failover) can be added without modifying callers.
 *
 * @example
 *   const db = require('./config/db');
 *   await db.connect();
 */
class DatabaseConnection {
  constructor() {
    // Singleton enforcement via constructor return
    if (DatabaseConnection.instance) {
      return DatabaseConnection.instance;
    }

    /** @type {mongoose.Connection|null} */
    this.connection = null;
    DatabaseConnection.instance = this;
  }

  /**
   * Static factory method for Singleton access.
   * @returns {DatabaseConnection} The single instance.
   */
  static getInstance() {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  /**
   * Establishes a connection to MongoDB if not already connected.
   * Uses the MONGODB_URI environment variable for the connection string.
   * Exits the process on failure (fail-fast principle).
   * @returns {Promise<mongoose.Connection>} The active Mongoose connection.
   */
  async connect() {
    if (this.connection) return this.connection;

    try {
      this.connection = await mongoose.connect(process.env.MONGODB_URI);
      console.log(`MongoDB Connected: ${this.connection.connection.host}`);
      return this.connection;
    } catch (error) {
      console.error(`MongoDB Connection Error: ${error.message}`);
      process.exit(1);
    }
  }
}

module.exports = DatabaseConnection.getInstance();
