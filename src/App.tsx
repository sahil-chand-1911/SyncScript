import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css'; // Minimal or basic css

// Connect to backend Socket.io
const SOCKET_SERVER_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

function App() {
  const [content, setContent] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // Allow user to enter Document ID
  const [documentId, setDocumentId] = useState('default-doc');
  const [activeDocId, setActiveDocId] = useState('default-doc');

  useEffect(() => {
    // Initialize socket connection
    const s = io(SOCKET_SERVER_URL);
    setSocket(s);

    s.on('connect', () => {
      console.log('Connected to server');
      // Join active document room
      s.emit('join-document', activeDocId);
    });

    s.on('load-document', (data) => {
      setContent(data);
    });

    s.on('receive-changes', (newContent) => {
      setContent(newContent);
    });

    return () => {
      s.disconnect();
    };
  }, [activeDocId]);

  const handleJoin = () => {
    if (documentId.trim() !== '' && documentId !== activeDocId) {
      // Leave old doc if needed
      socket?.emit('leave-document', activeDocId);
      
      // Update active which triggers useEffect to rejoin
      setActiveDocId(documentId);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setContent(newValue);
    
    if (socket) {
      socket.emit('send-changes', { documentId: activeDocId, content: newValue });
      
      // Basic autosave (you could debounce this locally for better performance)
      socket.emit('save-document', { documentId: activeDocId, content: newValue });
    }
  };

  return (
    <div className="app-container">
      <h1>Collaborative Editor</h1>
      
      <div style={{ marginBottom: '1rem' }}>
        <input 
          type="text" 
          value={documentId} 
          onChange={(e) => setDocumentId(e.target.value)}
          placeholder="Enter Document ID"
          style={{ padding: '0.5rem', marginRight: '0.5rem' }}
        />
        <button 
          onClick={handleJoin}
          style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
        >
          Join Room
        </button>
      </div>

      <p>Currently editing: <strong>{activeDocId}</strong></p>

      <textarea
        value={content}
        onChange={handleChange}
        placeholder="Start typing..."
        style={{
          width: '80%',
          height: '60vh',
          padding: '1rem',
          fontSize: '1rem',
          fontFamily: 'monospace',
          border: '1px solid #ccc',
          borderRadius: '8px'
        }}
      />
    </div>
  );
}

export default App;
