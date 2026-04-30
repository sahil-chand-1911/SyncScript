const { Sequelize } = require('sequelize');

class DatabaseConnection {
  constructor() {
    if (DatabaseConnection.instance) {
      return DatabaseConnection.instance;
    }

    // Initialize Sequelize synchronously so models can be required immediately.
    // process.env.DATABASE_URL must be set (dotenv loaded in server.js before this).
    this.sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://localhost/syncscript', {
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      logging: false
    });

    DatabaseConnection.instance = this;
  }

  static getInstance() {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  async connect() {
    try {
      await this.sequelize.authenticate();
      console.log('PostgreSQL Connected via Sequelize');
      return this.sequelize;
    } catch (error) {
      console.error(`PostgreSQL Connection Error: ${error.message}`);
      process.exit(1);
    }
  }

  getSequelize() {
    return this.sequelize;
  }
}

module.exports = DatabaseConnection.getInstance();
