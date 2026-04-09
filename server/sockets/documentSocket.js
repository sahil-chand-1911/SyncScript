const Document = require('../models/Document');

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
        document = await Document.create({ documentId, data: '' });
      }

      // Notify others in room
      socket.to(documentId).emit('user-joined', socket.id);

      // Give client initial data
      socket.emit('load-document', document.data);
    });

    // Handle leaving manually if needed
    socket.on('leave-document', (documentId) => {
      socket.leave(documentId);
      socket.to(documentId).emit('user-left', socket.id);
    });

    // Update document content (send-changes)
    socket.on('send-changes', (data) => {
      const { documentId, content } = data;
      // Broadcast the changes to everyone else in the document room
      socket.broadcast.to(documentId).emit('receive-changes', content);
    });

    // Save document to DB
    socket.on('save-document', async (data) => {
      const { documentId, content } = data;
      await Document.findOneAndUpdate(
        { documentId }, 
        { data: content, $inc: { version: 1 } }
      );
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};

module.exports = setupSockets;
