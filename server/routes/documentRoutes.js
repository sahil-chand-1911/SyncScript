const express = require('express');
const documentController = require('../controllers/documentController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, (req, res) => documentController.createDocument(req, res));
router.get('/:id', (req, res) => documentController.getDocument(req, res));

// Permission routes (protected)
router.get('/:id/permissions', protect, (req, res) => documentController.getPermissions(req, res));
router.post('/:id/share', protect, (req, res) => documentController.shareDocument(req, res));
router.delete('/:id/share/:userId', protect, (req, res) => documentController.removeCollaborator(req, res));

// Version history routes (protected)
router.get('/:id/versions', protect, (req, res) => documentController.getVersionHistory(req, res));
router.get('/:id/versions/:version', protect, (req, res) => documentController.getVersionContent(req, res));
router.post('/:id/restore/:version', protect, (req, res) => documentController.restoreVersion(req, res));

module.exports = router;
