const { Document, DocumentVersion, Collaborator } = require('../models');
const OTContext = require('../utils/ot');
const EventBus = require('./EventBus');
const DocumentManager = require('./DocumentSubject');

const SNAPSHOT_INTERVAL = 10;

class DocumentStateManager {

  async loadDocument(documentId, user) {
    const userId = user.id || user._id;

    let document = await Document.findOne({ 
      where: { documentId },
      include: [{ model: Collaborator, as: 'Collaborators' }]
    });

    if (!document) {
      document = await Document.create({
        documentId,
        data: '',
        version: 1,
        ownerId: userId,
      });
    }

    const role = document.getUserRole(userId);

    return {
      content: document.data,
      version: document.version,
      role: role || 'viewer',
    };
  }

  async applyOperation(documentId, operation, user) {
    const userId = user.id || user._id;
    
    const doc = await Document.findOne({ 
      where: { documentId },
      include: [{ model: Collaborator, as: 'Collaborators' }]
    });
    
    if (!doc) return { success: false, reason: 'Document not found' };

    const role = doc.getUserRole(userId);
    if (role === 'viewer') {
      return { success: false, reason: 'permission-denied' };
    }

    operation.userId = userId;
    operation.userName = user.name;
    operation.timestamp = Date.now();

    const subject = DocumentManager.getSubject(documentId);
    const history = subject.getHistory();
    const transformedOp = OTContext.catchUp(operation, history);

    if (!transformedOp) {
      return { success: false, reason: 'OT transformation failed' };
    }

    const nextVersion = doc.version + 1;
    transformedOp.version = nextVersion;

    const newContent = OTContext.applyOperation(doc.data, transformedOp);

    await doc.update({ data: newContent, version: nextVersion });

    subject.addHistory(transformedOp);

    if (nextVersion % SNAPSHOT_INTERVAL === 0) {
      await DocumentVersion.create({
        documentId,
        version: nextVersion,
        content: newContent,
        savedByUserId: userId,
        savedByUserName: user.name,
        label: 'Auto-save',
      }).catch(err => console.error('[Version] Snapshot save failed:', err.message));
    }

    EventBus.publish(EventBus.constructor.channel(documentId, 'operation'), {
      transformedOp,
      newVersion: nextVersion,
      sourceUserId: userId,
    });

    return { success: true, newVersion: nextVersion, transformedOp };
  }

  async applyFullReplace(documentId, content, user) {
    const userId = user.id || user._id;

    const document = await Document.findOne({ 
      where: { documentId },
      include: [{ model: Collaborator, as: 'Collaborators' }]
    });
    
    if (!document) return { success: false, reason: 'Document not found' };

    const role = document.getUserRole(userId);
    if (role === 'viewer') {
      return { success: false, reason: 'permission-denied' };
    }

    const nextVersion = document.version + 1;
    await document.update({ data: content, version: nextVersion });

    await DocumentVersion.create({
      documentId,
      version: nextVersion,
      content,
      savedByUserId: userId,
      savedByUserName: user.name,
      label: 'Full replace',
    }).catch(err => console.error('[Version] Snapshot save failed:', err.message));

    const subject = DocumentManager.getSubject(documentId);
    subject.history = [];

    EventBus.publish(EventBus.constructor.channel(documentId, 'changes'), {
      content,
      newVersion: nextVersion,
      sourceUserId: userId,
      userName: user.name,
      timestamp: Date.now(),
    });

    return { success: true, newVersion: nextVersion };
  }
}

module.exports = new DocumentStateManager();
