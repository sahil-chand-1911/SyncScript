import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { computeOperation, applyOperation, Operation } from '../utils/otLogic';

const SOCKET_SERVER_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

interface ActiveUser {
  id: string;
  name: string;
  email: string;
}

interface EditHistoryEntry {
  userName: string;
  type: 'insert' | 'delete' | 'replace';
  preview: string;
  timestamp: number;
}

interface EditorProps {
  token: string;
  user: { name: string; email: string };
  onLogout: () => void;
}

const MAX_HISTORY_ENTRIES = 30;

/**
 * Editor Page Component.
 * Manages local state, authenticated socket connections, OT synchronization,
 * real-time active user presence tracking, and edit history attribution.
 */
export default function Editor({ token, user, onLogout }: EditorProps) {
  const [content, setContent] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([]);

  const [documentId, setDocumentId] = useState('default-doc');
  const [activeDocId, setActiveDocId] = useState('default-doc');

  const contentRef = useRef('');
  const versionRef = useRef(1);

  /**
   * Syncs the mutable contentRef with the React content state.
   */
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  /**
   * Adds an entry to the edit history feed (capped at MAX_HISTORY_ENTRIES).
   */
  const addHistoryEntry = (entry: EditHistoryEntry) => {
    setEditHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY_ENTRIES));
  };

  /**
   * WebSocket Connection Lifecycle:
   * 1. Connects to the backend with JWT auth token.
   * 2. Registers listeners for OT operations, presence events, and admin events.
   * 3. Handles cleanup on unmount or room change.
   */
  useEffect(() => {
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
        onLogout();
      }
    });

    // Initial state load
    s.on('load-document', (data) => {
      setContent(data.content);
      versionRef.current = data.version;
      setEditHistory([]); // Clear history on room switch
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

    // ---- OT Events (with user attribution) ----
    s.on('receive-operation', (op: Operation) => {
      const updatedContent = applyOperation(contentRef.current, op);
      setContent(updatedContent);
      versionRef.current = op.version;

      // Record in edit history
      if (op.userName) {
        addHistoryEntry({
          userName: op.userName,
          type: op.type,
          preview: op.character.length > 20 ? op.character.slice(0, 20) + '…' : op.character,
          timestamp: op.timestamp || Date.now(),
        });
      }
    });

    s.on('operation-acknowledged', (newVersion) => {
      versionRef.current = newVersion;
    });

    s.on('receive-changes', (data: { content: string; userName: string; timestamp: number }) => {
      setContent(data.content);
      if (data.userName) {
        addHistoryEntry({
          userName: data.userName,
          type: 'replace',
          preview: 'Full document update',
          timestamp: data.timestamp || Date.now(),
        });
      }
    });

    return () => {
      s.disconnect();
    };
  }, [activeDocId, token]);

  /**
   * Room Swapping Logic.
   */
  const handleJoin = () => {
    if (documentId.trim() !== '' && documentId !== activeDocId) {
      socket?.emit('leave-document', activeDocId);
      setActiveDocId(documentId);
    }
  };

  /**
   * Change Handler (Critical Sync Point):
   * Records local edits in the history feed as well.
   */
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const op = computeOperation(contentRef.current, newValue, versionRef.current);

    setContent(newValue);

    if (socket && op) {
      socket.emit('send-operation', { documentId: activeDocId, operation: op });
      // Track own edit locally
      addHistoryEntry({
        userName: user.name,
        type: op.type,
        preview: op.character.length > 20 ? op.character.slice(0, 20) + '…' : op.character,
        timestamp: Date.now(),
      });
    } else if (socket && !op) {
      socket.emit('send-changes', { documentId: activeDocId, content: newValue });
      addHistoryEntry({
        userName: user.name,
        type: 'replace',
        preview: 'Full document update',
        timestamp: Date.now(),
      });
    }
  };

  const handleLogout = () => {
    socket?.disconnect();
    onLogout();
  };

  /**
   * Generates a consistent color for a user based on their name.
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

  /**
   * Formats a timestamp into a human-readable relative time string.
   */
  const formatTime = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
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

        {/* Sidebar: Active Users + Edit History */}
        <div className="presence-panel">
          {/* Active Users Section */}
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

          {/* Edit History Section */}
          {editHistory.length > 0 && (
            <>
              <div className="history-header">Recent Edits</div>
              <ul className="history-list">
                {editHistory.map((entry, idx) => (
                  <li key={idx} className="history-entry">
                    <span
                      className="history-dot"
                      style={{ backgroundColor: getAvatarColor(entry.userName) }}
                    ></span>
                    <div className="history-content">
                      <span className="history-user">{entry.userName}</span>
                      <span className={`history-type history-type--${entry.type}`}>
                        {entry.type === 'insert' ? '+ ' : entry.type === 'delete' ? '− ' : '⟲ '}
                        <span className="history-preview">{entry.preview}</span>
                      </span>
                      <span className="history-time">{formatTime(entry.timestamp)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
