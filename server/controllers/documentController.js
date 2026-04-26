const Document = require('../models/Document');
const DocumentVersion = require('../models/DocumentVersion');
const User = require('../models/User');

class DocumentController {
  
  // Retrieve a document
  async getDocument(req, res) {
    const { id } = req.params;
    try {
      const document = await Document.findOne({ documentId: id });
      
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      res.status(200).json(document);
    } catch (error) {
      res.status(500).json({ message: 'Server Error', error: error.message });
    }
  }

  // Create a new document explicitly
  async createDocument(req, res) {
    const { documentId, data } = req.body;
    try {
      const existingDoc = await Document.findOne({ documentId });
      if (existingDoc) {
        return res.status(400).json({ message: 'Document already exists' });
      }
      const document = await Document.create({ 
        documentId, 
        data: data || '',
        version: 1,
        owner: req.user._id, // Set creator as owner
      });
      res.status(201).json(document);
    } catch (error) {
      res.status(500).json({ message: 'Server Error', error: error.message });
    }
  }

  /**
   * @route   GET /api/documents/:id/permissions
   * @desc    Get the current user's role and the collaborators list for a document
   * @access  Protected
   */
  async getPermissions(req, res) {
    const { id } = req.params;
    try {
      const document = await Document.findOne({ documentId: id });
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      const userId = req.user._id.toString();
      const role = document.getUserRole(userId);

      res.json({
        role,
        owner: document.owner,
        collaborators: document.collaborators,
      });
    } catch (error) {
      res.status(500).json({ message: 'Server Error', error: error.message });
    }
  }

  /**
   * @route   POST /api/documents/:id/share
   * @desc    Share a document with another user (owner only)
   * @access  Protected (owner)
   */
  async shareDocument(req, res) {
    const { id } = req.params;
    const { email, role } = req.body;

    if (!email || !['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ message: 'Valid email and role (editor/viewer) are required' });
    }

    try {
      const document = await Document.findOne({ documentId: id });
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Only the owner can share
      const userRole = document.getUserRole(req.user._id.toString());
      if (userRole !== 'owner') {
        return res.status(403).json({ message: 'Only the document owner can share' });
      }

      // Find the target user
      const targetUser = await User.findOne({ email: email.toLowerCase() });
      if (!targetUser) {
        return res.status(404).json({ message: 'User not found with that email' });
      }

      // Don't allow sharing with yourself
      if (targetUser._id.toString() === req.user._id.toString()) {
        return res.status(400).json({ message: 'Cannot share with yourself' });
      }

      // Check if already a collaborator -> update their role
      const existingCollab = document.collaborators.find(
        (c) => c.userId.toString() === targetUser._id.toString()
      );

      if (existingCollab) {
        existingCollab.role = role;
      } else {
        document.collaborators.push({
          userId: targetUser._id,
          email: targetUser.email,
          name: targetUser.name,
          role,
        });
      }

      await document.save();

      res.json({
        message: `Document shared with ${targetUser.name} as ${role}`,
        collaborators: document.collaborators,
      });
    } catch (error) {
      res.status(500).json({ message: 'Server Error', error: error.message });
    }
  }

  /**
   * @route   DELETE /api/documents/:id/share/:userId
   * @desc    Remove a collaborator from a document (owner only)
   * @access  Protected (owner)
   */
  async removeCollaborator(req, res) {
    const { id, userId } = req.params;
    try {
      const document = await Document.findOne({ documentId: id });
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      const userRole = document.getUserRole(req.user._id.toString());
      if (userRole !== 'owner') {
        return res.status(403).json({ message: 'Only the document owner can manage access' });
      }

      document.collaborators = document.collaborators.filter(
        (c) => c.userId.toString() !== userId
      );
      await document.save();

      res.json({
        message: 'Collaborator removed',
        collaborators: document.collaborators,
      });
    } catch (error) {
      res.status(500).json({ message: 'Server Error', error: error.message });
    }
  }

  /**
   * @route   GET /api/documents/:id/versions
   * @desc    Get version history for a document (list of snapshots, newest first)
   * @access  Protected
   */
  async getVersionHistory(req, res) {
    const { id } = req.params;
    try {
      const versions = await DocumentVersion.find({ documentId: id })
        .select('version savedBy label createdAt')
        .sort({ version: -1 })
        .limit(50);

      res.json(versions);
    } catch (error) {
      res.status(500).json({ message: 'Server Error', error: error.message });
    }
  }

  /**
   * @route   GET /api/documents/:id/versions/:version
   * @desc    Get the full content of a specific version snapshot
   * @access  Protected
   */
  async getVersionContent(req, res) {
    const { id, version } = req.params;
    try {
      const snapshot = await DocumentVersion.findOne({
        documentId: id,
        version: parseInt(version),
      });

      if (!snapshot) {
        return res.status(404).json({ message: 'Version snapshot not found' });
      }

      res.json(snapshot);
    } catch (error) {
      res.status(500).json({ message: 'Server Error', error: error.message });
    }
  }

  /**
   * @route   POST /api/documents/:id/restore/:version
   * @desc    Restore a document to a previous version's content
   * @access  Protected
   */
  async restoreVersion(req, res) {
    const { id, version } = req.params;
    try {
      const snapshot = await DocumentVersion.findOne({
        documentId: id,
        version: parseInt(version),
      });

      if (!snapshot) {
        return res.status(404).json({ message: 'Version snapshot not found' });
      }

      const document = await Document.findOne({ documentId: id });
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      const nextVersion = document.version + 1;
      await Document.findOneAndUpdate(
        { documentId: id },
        { data: snapshot.content, version: nextVersion }
      );

      await DocumentVersion.create({
        documentId: id,
        version: nextVersion,
        content: snapshot.content,
        savedBy: {
          userId: req.user._id.toString(),
          userName: req.user.name,
        },
        label: `Restored from v${version}`,
      });

      res.json({
        message: `Document restored to version ${version}`,
        newVersion: nextVersion,
        content: snapshot.content,
      });
    } catch (error) {
      res.status(500).json({ message: 'Server Error', error: error.message });
    }
  }
}

// Export singleton instance of Controller
module.exports = new DocumentController();
