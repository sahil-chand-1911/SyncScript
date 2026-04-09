const express = require('express');
const documentController = require('../controllers/documentController');

const router = express.Router();

router.post('/', (req, res) => documentController.createDocument(req, res));
router.get('/:id', (req, res) => documentController.getDocument(req, res));

module.exports = router;
