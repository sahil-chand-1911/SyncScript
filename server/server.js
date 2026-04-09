require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const DatabaseConnection = require('./config/db');
const documentRoutes = require('./routes/documentRoutes');
const setupSockets = require('./sockets/documentSocket');

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

  async initializeDependencies() {
    // Uses the Singleton db
    await DatabaseConnection.connect();
  }

  initializeMiddleware() {
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST']
    }));
    this.app.use(express.json());
  }

  initializeRoutes() {
    this.app.use('/api/documents', documentRoutes);

    this.app.get('/', (req, res) => {
      res.send('SyncScript API is running...');
    });
  }

  initializeSockets() {
    setupSockets(this.io);
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`AppServer running on port ${this.port}`);
    });
  }
}

// Bootstrap
const bootServer = new AppServer();
bootServer.start();
