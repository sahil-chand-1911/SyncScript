import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { computeOperation, applyOperation } from '../utils/otLogic';

const SOCKET_SERVER_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

interface ActiveUser {
  id: string;
  name: string;
  email: string;
}

interface EditorProps {
  token: string;
  user: { name: string; email: string };
  onLogout: () => void;
}

/**
 * Editor Page Component.
 * Manages local state, authenticated socket connections, OT synchronization,
 * and real-time active user presence tracking.
 */
export default function Editor({ token, user, onLogout }: EditorProps) {
  const [content, setContent] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);

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
   * 2. Registers listeners for OT operations, presence events, and admin events.
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

    // ---- Presence Events ----
    s.on('active-users', (users: ActiveUser[]) => {
      setActiveUsers(users);
    });

    s.on('user-joined', (joinedUser: { name: string }) => {
      console.log(`${joinedUser.name} joined the document`);
    });

    s.on('user-left', (leftUser: { name: string }) => {
      console.log(`${leftUser.name} left the document`);
    });

    // ---- OT Events ----
    s.on('receive-operation', (op) => {
      const updatedContent = applyOperation(contentRef.current, op);
      setContent(updatedContent);
      versionRef.current = op.version;
    });

    s.on('operation-acknowledged', (newVersion) => {
      versionRef.current = newVersion;
    });

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

  /**
   * Generates a consistent color for a user's avatar based on their name.
   */
  const getAvatarColor = (name: string) => {
    const colors = [
      '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
      '#10b981', '#06b6d4', '#f97316', '#ef4444',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
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

      <div className="editor-layout">
        <textarea
          value={content}
          onChange={handleChange}
          placeholder="Start typing..."
          className="editor-textarea"
        />

        {/* Active Users Sidebar */}
        <div className="presence-panel">
          <div className="presence-header">
            <span className="presence-dot"></span>
            Online — {activeUsers.length}
          </div>
          <ul className="presence-list">
            {activeUsers.map((u) => (
              <li key={u.id} className="presence-user">
                <span
                  className="presence-avatar"
                  style={{ backgroundColor: getAvatarColor(u.name) }}
                >
                  {u.name.charAt(0).toUpperCase()}
                </span>
                <span className="presence-name">
                  {u.name}
                  {u.email === user.email && <span className="presence-you"> (you)</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
