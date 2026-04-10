import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { computeOperation, applyOperation } from './utils/otLogic';
import './App.css'; 

const SOCKET_SERVER_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

/**
 * Primary UI Component for the Collaborative Editor.
 * Manages local state, socket connections, and OT synchronization.
 */
function App() {
  const [content, setContent] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const [documentId, setDocumentId] = useState('default-doc');
  const [activeDocId, setActiveDocId] = useState('default-doc');

  const contentRef = useRef('');
  const versionRef = useRef(1);

  /**
   * Syncs the mutable contentRef with the React content state.
   * This is necessary because socket listeners need access to the latest content
   * without being recreated on every render.
   */
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  /**
   * WebSocket Connection Lifecycle:
   * 1. Connects to the backend on mount.
   * 2. Registers listeners for OT operations and administrative events.
   * 3. Handles cleanup on unmount or room change.
   */
  useEffect(() => {
    // Initialize Socket connection
    const s = io(SOCKET_SERVER_URL);
    setSocket(s);

    s.on('connect', () => {
      console.log('Connected to server');
      s.emit('join-document', activeDocId);
    });

    // Initial state load
    s.on('load-document', (data) => {
      setContent(data.content);
      versionRef.current = data.version;
    });

    // Handle incoming operations from other clients
    s.on('receive-operation', (op) => {
      // Apply the remote operation to the local text pool
      const updatedContent = applyOperation(contentRef.current, op);
      setContent(updatedContent);
      versionRef.current = op.version;
    });

    // Server acknowledgment of a locally sent operation
    s.on('operation-acknowledged', (newVersion) => {
      versionRef.current = newVersion;
    });

    // Fail-safe fallback listener for full content sync
    s.on('receive-changes', (newContent) => {
      setContent(newContent);
    });

    return () => {
      s.disconnect();
    };
  }, [activeDocId]);

  /**
   * Room Swapping Logic:
   * Exits the current document and joins a new one.
   */
  const handleJoin = () => {
    if (documentId.trim() !== '' && documentId !== activeDocId) {
      socket?.emit('leave-document', activeDocId);
      setActiveDocId(documentId);
    }
  };

  /**
   * Change Handler (Critical Sync Point):
   * 1. Computes the diff (Operation) between the old and new text.
   * 2. Updates local state immediately for responsiveness.
   * 3. Broadcasts the Operation to the server for distribution.
   */
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    
    // Compute the delta Operation
    const op = computeOperation(contentRef.current, newValue, versionRef.current);
    
    setContent(newValue);
    
    if (socket && op) {
      socket.emit('send-operation', { documentId: activeDocId, operation: op });
    } else if (socket && !op) {
      // Fallback for complex changes (e.g., massive copy-paste)
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
