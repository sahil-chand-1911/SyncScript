require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const DatabaseConnection = require('./config/db');
const documentRoutes = require('./routes/documentRoutes');
const authRoutes = require('./routes/authRoutes');
const setupSockets = require('./sockets/documentSocket');

/**
 * AppServer — Main Application Bootstrap.
 *
 * Orchestrates the initialization of all application layers:
 *   1. Database connection (Singleton)
 *   2. Express middleware (CORS, JSON parsing)
 *   3. RESTful API routes (Auth, Documents)
 *   4. WebSocket layer (Socket.IO + SocketManager)
 *
 * SOLID Principles:
 *   - Single Responsibility: Only handles server bootstrapping.
 *     Business logic lives in controllers/services.
 *   - Dependency Inversion: Depends on abstractions (route modules,
 *     setup functions) rather than concrete implementations.
 *
 * Design Pattern: Composition Root — this is the single entry point
 * where all dependencies are wired together.
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
   * Initializes external dependencies (database).
   * Uses the Singleton DatabaseConnection to prevent duplicate pools.
   */
  async initializeDependencies() {
    await DatabaseConnection.connect();
    const { sequelize } = require('./models');
    await sequelize.sync({ alter: true });
    console.log('Sequelize models synchronized.');
  }

  /**
   * Configures Express middleware stack.
   * Order matters: CORS → JSON parsing → routes.
   */
  initializeMiddleware() {
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST', 'DELETE']
    }));
    this.app.use(express.json());
  }

  /**
   * Mounts RESTful API route modules.
   * Each route module encapsulates its own controller logic.
   */
  initializeRoutes() {
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/documents', documentRoutes);

    this.app.get('/', (req, res) => {
      res.send('SyncScript API is running...');
    });
  }

  /**
   * Initializes the WebSocket layer by passing the Socket.IO
   * server to the SocketManager factory function.
   *
   * SCALING NOTE: To add Redis adapter for multi-server support:
   *   const { createAdapter } = require('@socket.io/redis-adapter');
   *   this.io.adapter(createAdapter(pubClient, subClient));
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

// Bootstrap the application
const bootServer = new AppServer();
bootServer.start();
