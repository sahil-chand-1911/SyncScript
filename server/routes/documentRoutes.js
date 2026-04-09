const express = require('express');
const { getDocument, createDocument } = require('../controllers/documentController');

const router = express.Router();

router.post('/', createDocument);
router.get('/:id', getDocument);

module.exports = router;
