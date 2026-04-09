const Document = require('../models/Document');
const { catchUpOperation, applyOperation } = require('../utils/ot');

// In-memory store for operations history (per documentId)
const documentHistories = {};

const setupSockets = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join a document room explicitly
    socket.on('join-document', async (documentId) => {
      // Leave any existing rooms before joining a new one
      socket.rooms.forEach((room) => {
        if (room !== socket.id) {
          socket.leave(room);
          socket.to(room).emit('user-left', socket.id);
        }
      });

      socket.join(documentId);
      
      let document = await Document.findOne({ documentId });
      
      if (!document) {
        document = await Document.create({ documentId, data: '', version: 1 });
      }

      if (!documentHistories[documentId]) {
        documentHistories[documentId] = [];
      }

      // Notify others in room
      socket.to(documentId).emit('user-joined', socket.id);

      // Give client initial data and current server version
      socket.emit('load-document', { content: document.data, version: document.version });
    });

    // Handle leaving manually if needed
    socket.on('leave-document', (documentId) => {
      socket.leave(documentId);
      socket.to(documentId).emit('user-left', socket.id);
    });

    // Handle incoming Operational Transformation
    socket.on('send-operation', async (data) => {
      const { documentId, operation } = data;
      // operation: { type, position, character, version }

      if (!documentHistories[documentId]) {
        documentHistories[documentId] = [];
      }

      const history = documentHistories[documentId];
      
      // Catch up the operation based on server history to resolve conflicts locally
      const transformedOp = catchUpOperation(operation, history);

      if (transformedOp) {
        // Find current document from DB (or we could cache it in RAM for speed, but MongoDB is fine for MVP)
        const document = await Document.findOne({ documentId });
        
        if (document) {
          // Increment version and attach to transformedOp
          const nextVersion = document.version + 1;
          transformedOp.version = nextVersion;

          // Apply to text
          const newContent = applyOperation(document.data, transformedOp);

          // Update DB
          await Document.findOneAndUpdate(
            { documentId }, 
            { data: newContent, version: nextVersion }
          );

          // Push to history
          history.push(transformedOp);

          // Acknowledge the sender so they know to increment their baseline version
          socket.emit('operation-acknowledged', nextVersion);

          // Broadcast the transformed operation cleanly to other clients
          socket.broadcast.to(documentId).emit('receive-operation', transformedOp);
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};

module.exports = setupSockets;
