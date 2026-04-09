const mongoose = require('mongoose');

class DatabaseConnection {
  constructor() {
    if (DatabaseConnection.instance) {
      return DatabaseConnection.instance;
    }

    this.connection = null;
    DatabaseConnection.instance = this;
  }

  static getInstance() {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

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
