const DocumentManager = require('../services/DocumentSubject');
const DocumentStateManager = require('../services/DocumentStateManager');
const { socketAuthMiddleware } = require('../middleware/authMiddleware');

/**
 * SocketManager — Thin WebSocket Transport Layer.
 *
 * After the Phase 7 refactor, this class is purely responsible for:
 *   1. Authenticating socket connections (JWT middleware)
 *   2. Mapping socket events to DocumentStateManager calls
 *   3. Routing responses back to the appropriate sockets
 *
 * All document state logic (OT, persistence, versioning, permissions)
 * is delegated to DocumentStateManager, which publishes results to the
 * EventBus. This makes the socket layer replaceable and horizontally scalable.
 *
 * SCALING NOTE:
 * With a Redis-backed EventBus + Socket.IO Redis adapter, multiple
 * server instances can share socket rooms across processes.
 */
class SocketManager {
  constructor(io) {
    this.io = io;
    this.activeSockets = new Map(); // socketId -> documentId

    // Apply JWT authentication middleware
    this.io.use(socketAuthMiddleware);

    this.io.on('connection', (socket) => this.handleConnection(socket));
  }

  /**
   * Registers socket event listeners.
   * Each handler is a thin wrapper that delegates to the state manager.
   */
  handleConnection(socket) {
    console.log(`User connected: ${socket.user.name} (${socket.id})`);

    socket.on('join-document', async (documentId) => {
      try {
        await this.handleJoinDocument(socket, documentId);
      } catch (err) {
        console.error(`[Socket Error] join-document failed:`, err);
      }
    });

    socket.on('leave-document', (documentId) => {
      this.handleLeaveDocument(socket, documentId);
    });

    socket.on('send-operation', async (data) => {
      try {
        await this.handleSendOperation(socket, data);
      } catch (err) {
        console.error(`[Socket Error] send-operation failed:`, err);
      }
    });

    socket.on('send-changes', async (data) => {
      try {
        await this.handleSendChanges(socket, data);
      } catch (err) {
        console.error(`[Socket Error] send-changes failed:`, err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user?.name || socket.id}`);
      const currentDocId = this.activeSockets.get(socket.id);
      if (currentDocId) {
        this.handleLeaveDocument(socket, currentDocId);
      }
      this.activeSockets.delete(socket.id);
    });
  }

  /**
   * Join: Subscribe to room, load state via StateManager, send initial payload.
   */
  async handleJoinDocument(socket, documentId) {
    const previousDocId = this.activeSockets.get(socket.id);
    if (previousDocId && previousDocId !== documentId) {
      this.handleLeaveDocument(socket, previousDocId);
    }

    // Subscribe via Observer Subject (presence tracking)
    const subject = DocumentManager.getSubject(documentId);
    subject.subscribe(socket);

    this.activeSockets.set(socket.id, documentId);
    socket.join(documentId);

    // Delegate state loading to the decoupled service
    const state = await DocumentStateManager.loadDocument(documentId, socket.user);

    socket.emit('load-document', state);
  }

  /**
   * Leave: Unsubscribe from room and presence.
   */
  handleLeaveDocument(socket, documentId) {
    const subject = DocumentManager.getSubject(documentId);
    subject.unsubscribe(socket);
    socket.leave(documentId);
    this.activeSockets.delete(socket.id);
  }

  /**
   * Operation: Delegate OT processing to StateManager, route responses.
   */
  async handleSendOperation(socket, data) {
    const { documentId, operation } = data;

    const result = await DocumentStateManager.applyOperation(
      documentId, operation, socket.user
    );

    if (!result.success) {
      if (result.reason === 'permission-denied') {
        socket.emit('permission-denied', { message: 'You have view-only access to this document' });
      }
      return;
    }

    // Route responses back via Observer Subject
    const subject = DocumentManager.getSubject(documentId);
    subject.notifyDirect(socket, 'operation-acknowledged', result.newVersion);
    subject.notifyOthers(socket, 'receive-operation', result.transformedOp);
    console.log(`[Socket] Broadcasted operation to ${documentId} by ${socket.user.name}`);
  }

  /**
   * Full Replace: Delegate to StateManager, broadcast to room.
   */
  async handleSendChanges(socket, data) {
    const { documentId, content } = data;

    const result = await DocumentStateManager.applyFullReplace(
      documentId, content, socket.user
    );

    if (!result.success) {
      if (result.reason === 'permission-denied') {
        socket.emit('permission-denied', { message: 'You have view-only access to this document' });
      }
      return;
    }

    const subject = DocumentManager.getSubject(documentId);
    subject.notifyDirect(socket, 'operation-acknowledged', result.newVersion);
    subject.notifyOthers(socket, 'receive-changes', {
      content,
      userId: socket.user.id,
      userName: socket.user.name,
      timestamp: Date.now(),
    });
    console.log(`[Socket] Broadcasted changes to ${documentId} by ${socket.user.name}`);
  }
}

// Export initialization hook
const setupSockets = (io) => {
  return new SocketManager(io);
}

module.exports = setupSockets;
