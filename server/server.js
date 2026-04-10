require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const DatabaseConnection = require('./config/db');
const documentRoutes = require('./routes/documentRoutes');
const setupSockets = require('./sockets/documentSocket');

/**
 * Main application server class that bootstraps the Express application,
 * HTTP server, Socket.io, and Database connections.
 */
class AppServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST']
      }
    });
    this.port = process.env.PORT || 5001;

    this.initializeDependencies();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeSockets();
  }

  /**
   * Initializes external dependencies like the Database.
   * Follows the Singleton pattern via DatabaseConnection.
   */
  async initializeDependencies() {
    // Uses the Singleton db
    await DatabaseConnection.connect();
  }

  /**
   * Configures Express middleware including CORS and JSON parsing.
   */
  initializeMiddleware() {
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST']
    }));
    this.app.use(express.json());
  }

  /**
   * Sets up RESTful API routes.
   */
  initializeRoutes() {
    this.app.use('/api/documents', documentRoutes);

    this.app.get('/', (req, res) => {
      res.send('SyncScript API is running...');
    });
  }

  /**
   * Initializes WebSocket logic by passing the IO instance to the SocketManager.
   */
  initializeSockets() {
    setupSockets(this.io);
  }

  /**
   * Starts the HTTP server on the configured port.
   */
  start() {
    this.server.listen(this.port, () => {
      console.log(`AppServer running on port ${this.port}`);
    });
  }
}

// Bootstrap
const bootServer = new AppServer();
bootServer.start();
