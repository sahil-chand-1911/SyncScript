const { Document, DocumentVersion, User, Collaborator } = require('../models');

class DocumentController {
  
  async getDocument(req, res) {
    const { id } = req.params;
    try {
      const document = await Document.findOne({ 
        where: { documentId: id },
        include: [{ model: Collaborator, as: 'Collaborators' }]
      });
      
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      res.status(200).json(document);
    } catch (error) {
      res.status(500).json({ message: 'Server Error', error: error.message });
    }
  }

  async createDocument(req, res) {
    const { documentId, data } = req.body;
    try {
      const existingDoc = await Document.findOne({ where: { documentId } });
      if (existingDoc) {
        return res.status(400).json({ message: 'Document already exists' });
      }
      const document = await Document.create({ 
        documentId, 
        data: data || '',
        version: 1,
        ownerId: req.user.id || req.user._id,
      });
      res.status(201).json(document);
    } catch (error) {
      res.status(500).json({ message: 'Server Error', error: error.message });
    }
  }

  async getPermissions(req, res) {
    const { id } = req.params;
    try {
      const document = await Document.findOne({ 
        where: { documentId: id },
        include: [{ model: Collaborator, as: 'Collaborators' }]
      });
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      const userId = (req.user.id || req.user._id).toString();
      const role = document.getUserRole(userId);

      res.json({
        role,
        owner: document.ownerId,
        collaborators: document.Collaborators || [],
      });
    } catch (error) {
      res.status(500).json({ message: 'Server Error', error: error.message });
    }
  }

  async shareDocument(req, res) {
    const { id } = req.params;
    const { email, role } = req.body;

    if (!email || !['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ message: 'Valid email and role are required' });
    }

    try {
      const document = await Document.findOne({ 
        where: { documentId: id },
        include: [{ model: Collaborator, as: 'Collaborators' }]
      });
      
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      const userId = (req.user.id || req.user._id).toString();
      const userRole = document.getUserRole(userId);
      if (userRole !== 'owner') {
        return res.status(403).json({ message: 'Only the document owner can share' });
      }

      const targetUser = await User.findOne({ where: { email: email.toLowerCase() } });
      if (!targetUser) {
        return res.status(404).json({ message: 'User not found with that email' });
      }

      if (targetUser.id === userId) {
        return res.status(400).json({ message: 'Cannot share with yourself' });
      }

      const [collaborator, created] = await Collaborator.findOrCreate({
        where: { userId: targetUser.id, documentId: id },
        defaults: { email: targetUser.email, name: targetUser.name, role }
      });

      if (!created) {
        await collaborator.update({ role });
      }

      const updatedCollaborators = await Collaborator.findAll({ where: { documentId: id } });

      res.json({
        message: `Document shared with ${targetUser.name} as ${role}`,
        collaborators: updatedCollaborators,
      });
    } catch (error) {
      res.status(500).json({ message: 'Server Error', error: error.message });
    }
  }

  async removeCollaborator(req, res) {
    const { id, userId } = req.params;
    try {
      const document = await Document.findOne({ where: { documentId: id } });
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      const currentUserId = (req.user.id || req.user._id).toString();
      const userRole = document.getUserRole(currentUserId);
      if (userRole !== 'owner') {
        return res.status(403).json({ message: 'Only the document owner can manage access' });
      }

      await Collaborator.destroy({ where: { documentId: id, userId } });
      const updatedCollaborators = await Collaborator.findAll({ where: { documentId: id } });

      res.json({
        message: 'Collaborator removed',
        collaborators: updatedCollaborators,
      });
    } catch (error) {
      res.status(500).json({ message: 'Server Error', error: error.message });
    }
  }

  async getVersionHistory(req, res) {
    const { id } = req.params;
    try {
      const versions = await DocumentVersion.findAll({ 
        where: { documentId: id },
        attributes: ['version', 'savedByUserName', 'label', 'createdAt'],
        order: [['version', 'DESC']],
        limit: 50
      });

      const formatted = versions.map(v => ({
        version: v.version,
        savedBy: { userName: v.savedByUserName },
        label: v.label,
        createdAt: v.createdAt
      }));

      res.json(formatted);
    } catch (error) {
      res.status(500).json({ message: 'Server Error', error: error.message });
    }
  }

  async getVersionContent(req, res) {
    const { id, version } = req.params;
    try {
      const snapshot = await DocumentVersion.findOne({
        where: { documentId: id, version: parseInt(version) }
      });

      if (!snapshot) {
        return res.status(404).json({ message: 'Version snapshot not found' });
      }

      res.json(snapshot);
    } catch (error) {
      res.status(500).json({ message: 'Server Error', error: error.message });
    }
  }

  async restoreVersion(req, res) {
    const { id, version } = req.params;
    try {
      const snapshot = await DocumentVersion.findOne({
        where: { documentId: id, version: parseInt(version) }
      });

      if (!snapshot) {
        return res.status(404).json({ message: 'Version snapshot not found' });
      }

      const document = await Document.findOne({ where: { documentId: id } });
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      const nextVersion = document.version + 1;
      await document.update({ data: snapshot.content, version: nextVersion });

      await DocumentVersion.create({
        documentId: id,
        version: nextVersion,
        content: snapshot.content,
        savedByUserId: (req.user.id || req.user._id).toString(),
        savedByUserName: req.user.name,
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

module.exports = new DocumentController();
