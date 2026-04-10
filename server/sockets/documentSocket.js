const Document = require('../models/Document');
const OTContext = require('../utils/ot');
const DocumentManager = require('../services/DocumentSubject');

/**
 * Manages WebSocket connections and orchestrates the synchronization flow.
 * Acts as a bridge between Socket.io events and the OT/Observer systems.
 */
class SocketManager {
  constructor(io) {
    this.io = io;
    this.activeSockets = new Map(); // Keep track of which room a socket is in
    
    this.io.on('connection', (socket) => this.handleConnection(socket));
  }

  /**
   * Registers primary socket event listeners upon connection.
   */
  handleConnection(socket) {
    console.log('User connected:', socket.id);

    socket.on('join-document', async (documentId) => {
      this.handleJoinDocument(socket, documentId);
    });

    socket.on('leave-document', (documentId) => {
      this.handleLeaveDocument(socket, documentId);
    });

    socket.on('send-operation', async (data) => {
      this.handleSendOperation(socket, data);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      const currentDocId = this.activeSockets.get(socket.id);
      if (currentDocId) {
        this.handleLeaveDocument(socket, currentDocId);
      }
      this.activeSockets.delete(socket.id);
    });
  }

  /**
   * Handles a client joining a specific document room.
   * Subscribes the socket to the DocumentSubject (Observer Pattern).
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
    socket.join(documentId); // We still use native channels to group traffic natively

    let document = await Document.findOne({ documentId });
    if (!document) {
      document = await Document.create({ documentId, data: '', version: 1 });
    }

    // Direct initial payload
    socket.emit('load-document', { content: document.data, version: document.version });
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
   * 1. Fetches history from the Subject.
   * 2. Transforms the operation against missed history (Strategy Pattern).
   * 3. Persists the new state and history.
   * 4. Notifies all observers (Observer Pattern).
   */
  async handleSendOperation(socket, data) {
    const { documentId, operation } = data;
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

        // Notify Observers directly
        subject.notifyDirect(socket, 'operation-acknowledged', nextVersion);
        subject.notifyOthers(socket, 'receive-operation', transformedOp);
      }
    }
  }
}

// Export initialization singleton hook
const setupSockets = (io) => {
  return new SocketManager(io);
}

module.exports = setupSockets;
