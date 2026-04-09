const Document = require('../models/Document');
const OTContext = require('../utils/ot');
const DocumentManager = require('../services/DocumentSubject');

class SocketManager {
  constructor(io) {
    this.io = io;
    this.activeSockets = new Map(); // Keep track of which room a socket is in
    
    this.io.on('connection', (socket) => this.handleConnection(socket));
  }

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

  handleLeaveDocument(socket, documentId) {
    const subject = DocumentManager.getSubject(documentId);
    subject.unsubscribe(socket);
    socket.leave(documentId);
    this.activeSockets.delete(socket.id);
  }

  async handleSendOperation(socket, data) {
    const { documentId, operation } = data;
    const subject = DocumentManager.getSubject(documentId);
    const history = subject.getHistory();

    // Use pure Strategy Pattern Context Math
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

        // Notify Observer Patterns directly
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
