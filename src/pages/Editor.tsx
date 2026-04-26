import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { computeOperation, applyOperation } from '../utils/otLogic';

const SOCKET_SERVER_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

interface EditorProps {
  token: string;
  user: { name: string; email: string };
  onLogout: () => void;
}

/**
 * Editor Page Component.
 * Manages local state, authenticated socket connections, and OT synchronization.
 */
export default function Editor({ token, user, onLogout }: EditorProps) {
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
   * 1. Connects to the backend with JWT auth token.
   * 2. Registers listeners for OT operations and administrative events.
   * 3. Handles cleanup on unmount or room change.
   */
  useEffect(() => {
    // Initialize Socket connection WITH authentication
    const s = io(SOCKET_SERVER_URL, {
      auth: { token },
    });
    setSocket(s);

    s.on('connect', () => {
      console.log('Connected to server (authenticated)');
      s.emit('join-document', activeDocId);
    });

    s.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      if (err.message.includes('Authentication')) {
        // Token is invalid or expired, force logout
        onLogout();
      }
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
  }, [activeDocId, token]);

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

  const handleLogout = () => {
    socket?.disconnect();
    onLogout();
  };

  return (
    <div className="app-container">
      <div className="editor-header">
        <h1>📝 SyncScript</h1>
        <div className="user-info">
          <span className="user-badge">{user.name}</span>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>

      <div className="editor-toolbar">
        <input
          type="text"
          value={documentId}
          onChange={(e) => setDocumentId(e.target.value)}
          placeholder="Enter Document ID"
          className="doc-input"
        />
        <button onClick={handleJoin} className="join-btn">
          Join Room
        </button>
        <span className="active-doc">
          Editing: <strong>{activeDocId}</strong>
        </span>
      </div>

      <textarea
        value={content}
        onChange={handleChange}
        placeholder="Start typing..."
        className="editor-textarea"
      />
    </div>
  );
}
