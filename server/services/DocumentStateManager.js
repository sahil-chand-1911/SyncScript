const Document = require('../models/Document');
const DocumentVersion = require('../models/DocumentVersion');
const OTContext = require('../utils/ot');
const EventBus = require('./EventBus');
const DocumentManager = require('./DocumentSubject');

const SNAPSHOT_INTERVAL = 10;

/**
 * DocumentStateManager — Decoupled Document State Service.
 *
 * This service owns ALL document state mutations. The WebSocket layer
 * (SocketManager) delegates business logic here instead of directly
 * querying MongoDB and managing OT. After each mutation, events are
 * published to the EventBus for any interested subscriber.
 *
 * SCALING BENEFIT:
 * - The socket layer becomes a thin transport adapter.
 * - Multiple server instances can share state through the EventBus
 *   (backed by Redis in production).
 * - Document logic is testable without socket dependencies.
 *
 * Design Pattern: Service Layer + Event-Driven Architecture
 */
class DocumentStateManager {

  /**
   * Loads or creates a document and returns its initial state + user role.
   * @param {string} documentId
   * @param {object} user - { id, name, email }
   * @returns {{ content: string, version: number, role: string }}
   */
  async loadDocument(documentId, user) {
    let document = await Document.findOne({ documentId });
    if (!document) {
      document = await Document.create({
        documentId,
        data: '',
        version: 1,
        owner: user.id,
      });
    }

    const role = document.getUserRole(user.id);

    return {
      content: document.data,
      version: document.version,
      role: role || 'viewer',
    };
  }

  /**
   * Processes an OT operation against the document state.
   * Transforms, persists, snapshots, and publishes the result.
   *
   * @param {string} documentId
   * @param {object} operation - Raw operation from client
   * @param {object} user - { id, name }
   * @returns {{ success: boolean, newVersion?: number, transformedOp?: object }}
   */
  async applyOperation(documentId, operation, user) {
    // Permission check
    const doc = await Document.findOne({ documentId });
    if (!doc) return { success: false, reason: 'Document not found' };

    const role = doc.getUserRole(user.id);
    if (role === 'viewer') {
      return { success: false, reason: 'permission-denied' };
    }

    // Stamp user identity
    operation.userId = user.id;
    operation.userName = user.name;
    operation.timestamp = Date.now();

    // OT transformation against history
    const subject = DocumentManager.getSubject(documentId);
    const history = subject.getHistory();
    const transformedOp = OTContext.catchUp(operation, history);

    if (!transformedOp) {
      return { success: false, reason: 'OT transformation failed' };
    }

    const nextVersion = doc.version + 1;
    transformedOp.version = nextVersion;

    const newContent = OTContext.applyOperation(doc.data, transformedOp);

    // Persist to MongoDB
    await Document.findOneAndUpdate(
      { documentId },
      { data: newContent, version: nextVersion }
    );

    subject.addHistory(transformedOp);

    // Auto-snapshot at intervals
    if (nextVersion % SNAPSHOT_INTERVAL === 0) {
      await DocumentVersion.create({
        documentId,
        version: nextVersion,
        content: newContent,
        savedBy: { userId: user.id, userName: user.name },
        label: 'Auto-save',
      }).catch(err => console.error('[Version] Snapshot save failed:', err.message));
    }

    // Publish to EventBus — any listener (local or remote) can react
    EventBus.publish(EventBus.constructor.channel(documentId, 'operation'), {
      transformedOp,
      newVersion: nextVersion,
      sourceUserId: user.id,
    });

    return { success: true, newVersion: nextVersion, transformedOp };
  }

  /**
   * Applies a full content replacement (e.g. large paste, version restore).
   *
   * @param {string} documentId
   * @param {string} content - New full content
   * @param {object} user - { id, name }
   * @returns {{ success: boolean, newVersion?: number }}
   */
  async applyFullReplace(documentId, content, user) {
    const document = await Document.findOne({ documentId });
    if (!document) return { success: false, reason: 'Document not found' };

    const role = document.getUserRole(user.id);
    if (role === 'viewer') {
      return { success: false, reason: 'permission-denied' };
    }

    const nextVersion = document.version + 1;
    await Document.findOneAndUpdate(
      { documentId },
      { data: content, version: nextVersion }
    );

    // Always snapshot on full replacements
    await DocumentVersion.create({
      documentId,
      version: nextVersion,
      content,
      savedBy: { userId: user.id, userName: user.name },
      label: 'Full replace',
    }).catch(err => console.error('[Version] Snapshot save failed:', err.message));

    // Clear OT history (context invalidated by full replace)
    const subject = DocumentManager.getSubject(documentId);
    subject.history = [];

    // Publish to EventBus
    EventBus.publish(EventBus.constructor.channel(documentId, 'changes'), {
      content,
      newVersion: nextVersion,
      sourceUserId: user.id,
      userName: user.name,
      timestamp: Date.now(),
    });

    return { success: true, newVersion: nextVersion };
  }
}

module.exports = new DocumentStateManager();
