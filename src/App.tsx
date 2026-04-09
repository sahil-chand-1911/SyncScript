import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { computeOperation, applyOperation } from './utils/otLogic';
import './App.css'; 

const SOCKET_SERVER_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

function App() {
  const [content, setContent] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const [documentId, setDocumentId] = useState('default-doc');
  const [activeDocId, setActiveDocId] = useState('default-doc');

  const contentRef = useRef('');
  const versionRef = useRef(1);

  // Avoid cascading renders by keeping Socket initialize entirely in effect cleanly or using useRef
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    // Only connect once securely
    const s = io(SOCKET_SERVER_URL);
    setSocket(s);

    s.on('connect', () => {
      console.log('Connected to server');
      s.emit('join-document', activeDocId);
    });

    s.on('load-document', (data) => {
      setContent(data.content);
      versionRef.current = data.version;
    });

    s.on('receive-operation', (op) => {
      // Apply the operation to the current local string
      const updatedContent = applyOperation(contentRef.current, op);
      setContent(updatedContent);
      versionRef.current = op.version;
    });

    s.on('operation-acknowledged', (newVersion) => {
      versionRef.current = newVersion;
    });

    // Deprecated from Phase 4, keeping standard overwrite as fail-safe if server falls back
    s.on('receive-changes', (newContent) => {
      setContent(newContent);
    });

    return () => {
      s.disconnect();
    };
  }, [activeDocId]);

  const handleJoin = () => {
    if (documentId.trim() !== '' && documentId !== activeDocId) {
      socket?.emit('leave-document', activeDocId);
      setActiveDocId(documentId);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    
    // Compute OT Delta
    const op = computeOperation(contentRef.current, newValue, versionRef.current);
    
    setContent(newValue);
    
    if (socket && op) {
      socket.emit('send-operation', { documentId: activeDocId, operation: op });
    } else if (socket && !op) {
      // If compute failed (complex multidiff), fallback to Phase 4 raw save natively via operation
      // For basic OT, if it fails to compute (like wiping the whole screen), we usually reset the document globally
      socket.emit('send-changes', { documentId: activeDocId, content: newValue });
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
