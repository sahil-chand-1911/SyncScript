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

interface DocumentVersion {
  version: number;
  savedBy?: { userId: string; userName: string };
  label: string;
  createdAt: string;
  content?: string;
}

interface Collaborator {
  userId: string;
  email: string;
  name: string;
  role: 'editor' | 'viewer';
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
 * real-time presence tracking, edit history, version snapshots, and role-based permissions.
 */
export default function Editor({ token, user, onLogout }: EditorProps) {
  const [content, setContent] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([]);

  const [documentId, setDocumentId] = useState('default-doc');
  const [activeDocId, setActiveDocId] = useState('default-doc');

  // Version History States
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionsList, setVersionsList] = useState<DocumentVersion[]>([]);
  const [viewingVersion, setViewingVersion] = useState<DocumentVersion | null>(null);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  // Permission States
  const [userRole, setUserRole] = useState<string>('editor');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<'editor' | 'viewer'>('editor');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [shareMessage, setShareMessage] = useState('');

  const contentRef = useRef('');
  const versionRef = useRef(1);

  const isViewer = userRole === 'viewer';
  const isOwner = userRole === 'owner';

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const addHistoryEntry = (entry: EditHistoryEntry) => {
    setEditHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY_ENTRIES));
  };

  /**
   * WebSocket Connection Lifecycle
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

    s.on('load-document', (data) => {
      setContent(data.content);
      versionRef.current = data.version;
      setUserRole(data.role || 'editor');
      setEditHistory([]);
      setShowVersionModal(false);
    });

    // ---- Permission Events ----
    s.on('permission-denied', (data: { message: string }) => {
      alert(data.message);
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
    s.on('receive-operation', (op: Operation) => {
      const updatedContent = applyOperation(contentRef.current, op);
      setContent(updatedContent);
      versionRef.current = op.version;

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
          preview: 'Restored / Full document replace',
          timestamp: data.timestamp || Date.now(),
        });
      }
    });

    return () => {
      s.disconnect();
    };
  }, [activeDocId, token]);

  const handleJoin = () => {
    if (documentId.trim() !== '' && documentId !== activeDocId) {
      socket?.emit('leave-document', activeDocId);
      setActiveDocId(documentId);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isViewer) return; // Extra safety

    const newValue = e.target.value;
    const op = computeOperation(contentRef.current, newValue, versionRef.current);

    setContent(newValue);

    if (socket && op) {
      socket.emit('send-operation', { documentId: activeDocId, operation: op });
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
        preview: 'Full document replace',
        timestamp: Date.now(),
      });
    }
  };

  // --- Version History Logic ---

  const openVersionHistory = async () => {
    setShowVersionModal(true);
    setViewingVersion(null);
    setIsLoadingVersions(true);
    try {
      const res = await fetch(`${SOCKET_SERVER_URL}/api/documents/${activeDocId}/versions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVersionsList(data);
      }
    } catch (err) {
      console.error('Failed to fetch versions', err);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const viewVersionContent = async (versionNumber: number) => {
    try {
      const res = await fetch(`${SOCKET_SERVER_URL}/api/documents/${activeDocId}/versions/${versionNumber}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setViewingVersion(data);
      }
    } catch (err) {
      console.error('Failed to fetch version content', err);
    }
  };

  const handleRestoreVersion = () => {
    if (!viewingVersion || !viewingVersion.content || !socket || isViewer) return;

    socket.emit('send-changes', {
      documentId: activeDocId,
      content: viewingVersion.content
    });

    setContent(viewingVersion.content);
    addHistoryEntry({
      userName: user.name,
      type: 'replace',
      preview: `Restored to v${viewingVersion.version}`,
      timestamp: Date.now(),
    });

    setShowVersionModal(false);
    setViewingVersion(null);
  };

  // --- Share Logic ---

  const openShareModal = async () => {
    setShowShareModal(true);
    setShareMessage('');
    try {
      const res = await fetch(`${SOCKET_SERVER_URL}/api/documents/${activeDocId}/permissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCollaborators(data.collaborators || []);
      }
    } catch (err) {
      console.error('Failed to fetch permissions', err);
    }
  };

  const handleShare = async () => {
    if (!shareEmail.trim()) return;
    setShareMessage('');
    try {
      const res = await fetch(`${SOCKET_SERVER_URL}/api/documents/${activeDocId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: shareEmail.trim(), role: shareRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setCollaborators(data.collaborators || []);
        setShareEmail('');
        setShareMessage(`✅ ${data.message}`);
      } else {
        setShareMessage(`❌ ${data.message}`);
      }
    } catch (err) {
      setShareMessage('❌ Failed to share');
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    try {
      const res = await fetch(`${SOCKET_SERVER_URL}/api/documents/${activeDocId}/share/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setCollaborators(data.collaborators || []);
      }
    } catch (err) {
      console.error('Failed to remove collaborator', err);
    }
  };

  const handleLogout = () => {
    socket?.disconnect();
    onLogout();
  };

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

  const formatTime = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const getRoleBadge = () => {
    const labels: Record<string, { text: string; className: string }> = {
      owner: { text: 'Owner', className: 'role-badge role-owner' },
      editor: { text: 'Editor', className: 'role-badge role-editor' },
      viewer: { text: 'Viewer', className: 'role-badge role-viewer' },
    };
    const info = labels[userRole] || labels.viewer;
    return <span className={info.className}>{info.text}</span>;
  };

  return (
    <div className="app-container">
      <div className="editor-header">
        <h1>📝 SyncScript</h1>
        <div className="user-info">
          {getRoleBadge()}
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
        <div style={{ flex: 1 }}></div>
        {isOwner && (
          <button onClick={openShareModal} className="share-btn">
            👥 Share
          </button>
        )}
        <button onClick={openVersionHistory} className="version-btn">
          🕒 History
        </button>
      </div>

      {isViewer && (
        <div className="viewer-banner">
          🔒 You have view-only access to this document
        </div>
      )}

      <div className="editor-layout">
        <textarea
          value={content}
          onChange={handleChange}
          placeholder={isViewer ? 'View-only mode...' : 'Start typing...'}
          className={`editor-textarea ${isViewer ? 'readonly-textarea' : ''}`}
          readOnly={isViewer}
        />

        {/* Sidebar: Active Users + Edit History */}
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

      {/* Version History Modal */}
      {showVersionModal && (
        <div className="modal-overlay">
          <div className="modal-content version-modal">
            <div className="modal-header">
              <h2>Version History</h2>
              <button
                className="close-modal-btn"
                onClick={() => setShowVersionModal(false)}
              >
                ×
              </button>
            </div>

            <div className="version-modal-body">
              <div className="version-list-col">
                {isLoadingVersions ? (
                  <p className="loading-text">Loading versions...</p>
                ) : versionsList.length === 0 ? (
                  <p className="empty-text">No versions saved yet. Type more to auto-save.</p>
                ) : (
                  <ul className="version-list">
                    {versionsList.map(v => (
                      <li
                        key={v.version}
                        className={`version-item ${viewingVersion?.version === v.version ? 'selected' : ''}`}
                        onClick={() => viewVersionContent(v.version)}
                      >
                        <div className="version-meta">
                          <strong>v{v.version}</strong>
                          <span>{new Date(v.createdAt).toLocaleTimeString()}, {new Date(v.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="version-author">
                          Saved by: {v.savedBy?.userName || 'System'}
                          <span className="version-label">{v.label}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="version-preview-col">
                {viewingVersion ? (
                  <>
                    <div className="preview-header">
                      <h3>Preview: v{viewingVersion.version}</h3>
                      {!isViewer && (
                        <button className="restore-btn" onClick={handleRestoreVersion}>
                          Restore This Version
                        </button>
                      )}
                    </div>
                    <div className="preview-content">
                      {viewingVersion.content || <em className="empty-content">Empty document</em>}
                    </div>
                  </>
                ) : (
                  <div className="preview-empty">
                    <p>Select a version from the left to view its content.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="modal-overlay">
          <div className="modal-content share-modal">
            <div className="modal-header">
              <h2>Share Document</h2>
              <button
                className="close-modal-btn"
                onClick={() => setShowShareModal(false)}
              >
                ×
              </button>
            </div>

            <div className="share-modal-body">
              <div className="share-form">
                <input
                  type="email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="share-email-input"
                />
                <select
                  value={shareRole}
                  onChange={(e) => setShareRole(e.target.value as 'editor' | 'viewer')}
                  className="share-role-select"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button onClick={handleShare} className="share-submit-btn">
                  Share
                </button>
              </div>
              {shareMessage && (
                <p className="share-message">{shareMessage}</p>
              )}

              {collaborators.length > 0 && (
                <div className="collab-section">
                  <h3>Collaborators</h3>
                  <ul className="collab-list">
                    {collaborators.map((c) => (
                      <li key={c.userId} className="collab-item">
                        <span
                          className="presence-avatar"
                          style={{ backgroundColor: getAvatarColor(c.name || c.email) }}
                        >
                          {(c.name || c.email).charAt(0).toUpperCase()}
                        </span>
                        <div className="collab-info">
                          <span className="collab-name">{c.name || c.email}</span>
                          <span className={`collab-role role-badge role-${c.role}`}>{c.role}</span>
                        </div>
                        <button
                          className="collab-remove-btn"
                          onClick={() => handleRemoveCollaborator(c.userId)}
                          title="Remove access"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
