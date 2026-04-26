const Document = require('../models/Document');
const DocumentVersion = require('../models/DocumentVersion');
const OTContext = require('../utils/ot');
const DocumentManager = require('../services/DocumentSubject');
const { socketAuthMiddleware } = require('../middleware/authMiddleware');

// Save a version snapshot every N operations
const SNAPSHOT_INTERVAL = 10;

/**
 * Manages WebSocket connections and orchestrates the synchronization flow.
 * Acts as a bridge between Socket.io events and the OT/Observer systems.
 */
class SocketManager {
  constructor(io) {
    this.io = io;
    this.activeSockets = new Map(); // Keep track of which room a socket is in
    
    // Apply JWT authentication middleware to all socket connections
    this.io.use(socketAuthMiddleware);
    
    this.io.on('connection', (socket) => this.handleConnection(socket));
  }

  /**
   * Registers primary socket event listeners upon connection.
   */
  handleConnection(socket) {
    console.log(`User connected: ${socket.user.name} (${socket.id})`);

    socket.on('join-document', async (documentId) => {
      this.handleJoinDocument(socket, documentId);
    });

    socket.on('leave-document', (documentId) => {
      this.handleLeaveDocument(socket, documentId);
    });

    socket.on('send-operation', async (data) => {
      console.log(`[Socket] Received send-operation from ${socket.id}`, data.operation);
      try {
        await this.handleSendOperation(socket, data);
      } catch (err) {
        console.error(`[Socket Error] handleSendOperation failed:`, err);
      }
    });

    socket.on('send-changes', async (data) => {
      console.log(`[Socket] Received send-changes from ${socket.id}`);
      try {
        await this.handleSendChanges(socket, data);
      } catch (err) {
        console.error(`[Socket Error] handleSendChanges failed:`, err);
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
   * Handles a client joining a specific document room.
   * Checks permissions and sends the user's role to the client.
   * @param {Socket} socket - The Socket.io instance.
   * @param {string} documentId - The unique ID of the document.
   */
  async handleJoinDocument(socket, documentId) {
    const previousDocId = this.activeSockets.get(socket.id);
    
    if (previousDocId && previousDocId !== documentId) {
      this.handleLeaveDocument(socket, previousDocId);
    }

    // Subscribe via Observer Subject
    const subject = DocumentManager.getSubject(documentId);
    subject.subscribe(socket);
    
    this.activeSockets.set(socket.id, documentId);
    socket.join(documentId);

    let document = await Document.findOne({ documentId });
    if (!document) {
      // First user to create this document becomes the owner
      document = await Document.create({ 
        documentId, 
        data: '', 
        version: 1,
        owner: socket.user.id,
      });
    }

    // Determine the user's role for this document
    const role = document.getUserRole(socket.user.id);

    // Send initial payload with role information
    socket.emit('load-document', { 
      content: document.data, 
      version: document.version,
      role: role || 'viewer', // Default to viewer if no explicit access
    });
  }

  /**
   * Removes a client from a document room and unsubscribes them from the subject.
   */
  handleLeaveDocument(socket, documentId) {
    const subject = DocumentManager.getSubject(documentId);
    subject.unsubscribe(socket);
    socket.leave(documentId);
    this.activeSockets.delete(socket.id);
  }

  /**
   * Processes an incoming Operational Transformation (OT) operation.
   * 1. Stamps user identity and timestamp onto the operation.
   * 2. Fetches history from the Subject.
   * 3. Transforms the operation against missed history (Strategy Pattern).
   * 4. Persists the new state and history.
   * 5. Notifies all observers (Observer Pattern).
   */
  async handleSendOperation(socket, data) {
    const { documentId, operation } = data;

    // Permission check: viewers cannot edit
    const doc = await Document.findOne({ documentId });
    if (doc) {
      const role = doc.getUserRole(socket.user.id);
      if (role === 'viewer') {
        socket.emit('permission-denied', { message: 'You have view-only access to this document' });
        return;
      }
    }

    // Stamp authenticated user identity and timestamp onto the operation
    operation.userId = socket.user.id;
    operation.userName = socket.user.name;
    operation.timestamp = Date.now();

    const subject = DocumentManager.getSubject(documentId);
    const history = subject.getHistory();

    // Use Strategy Pattern (OT Math) to catch up the operation
    const transformedOp = OTContext.catchUp(operation, history);

    if (transformedOp) {
      const document = await Document.findOne({ documentId });
      if (document) {
        const nextVersion = document.version + 1;
        transformedOp.version = nextVersion;

        const newContent = OTContext.applyOperation(document.data, transformedOp);

        await Document.findOneAndUpdate(
          { documentId }, 
          { data: newContent, version: nextVersion }
        );

        subject.addHistory(transformedOp);

        // Auto-save version snapshot at regular intervals
        if (nextVersion % SNAPSHOT_INTERVAL === 0) {
          await DocumentVersion.create({
            documentId,
            version: nextVersion,
            content: newContent,
            savedBy: { userId: socket.user.id, userName: socket.user.name },
            label: 'Auto-save',
          }).catch(err => console.error('[Version] Snapshot save failed:', err.message));
          console.log(`[Version] Auto-saved snapshot v${nextVersion} for ${documentId}`);
        }

        // Notify Observers directly
        subject.notifyDirect(socket, 'operation-acknowledged', nextVersion);
        subject.notifyOthers(socket, 'receive-operation', transformedOp);
        console.log(`[Socket] Broadcasted receive-operation to room ${documentId} by ${socket.user.name}`);
      }
    }
  }

  /**
   * Processes a massive fallback operational change (like a massive copy/paste).
   * Overrides the current document content entirely.
   * Stamps user identity for attribution.
   */
  async handleSendChanges(socket, data) {
    const { documentId, content } = data;
    const document = await Document.findOne({ documentId });
    if (document) {
      // Permission check: viewers cannot edit
      const role = document.getUserRole(socket.user.id);
      if (role === 'viewer') {
        socket.emit('permission-denied', { message: 'You have view-only access to this document' });
        return;
      }

      const nextVersion = document.version + 1;
      await Document.findOneAndUpdate(
        { documentId }, 
        { data: content, version: nextVersion }
      );

      // Always snapshot on full-content changes (significant edits)
      await DocumentVersion.create({
        documentId,
        version: nextVersion,
        content,
        savedBy: { userId: socket.user.id, userName: socket.user.name },
        label: 'Full replace',
      }).catch(err => console.error('[Version] Snapshot save failed:', err.message));
      
      const subject = DocumentManager.getSubject(documentId);
      // We clear the history to avoid invalidating new operations against an old context pool
      subject.history = []; 
      
      subject.notifyDirect(socket, 'operation-acknowledged', nextVersion);
      subject.notifyOthers(socket, 'receive-changes', {
        content,
        userId: socket.user.id,
        userName: socket.user.name,
        timestamp: Date.now(),
      });
      console.log(`[Socket] Broadcasted receive-changes to room ${documentId} by ${socket.user.name}`);
    }
  }
}

// Export initialization singleton hook
const setupSockets = (io) => {
  return new SocketManager(io);
}

module.exports = setupSockets;
