const Document = require('../models/Document');

// Create a new document explicitly
const createDocument = async (req, res) => {
  const { documentId, data } = req.body;
  try {
    const existingDoc = await Document.findOne({ documentId });
    if (existingDoc) {
      return res.status(400).json({ message: 'Document already exists' });
    }
    const document = await Document.create({ 
      documentId, 
      data: data || '',
      version: 1
    });
    res.status(201).json(document);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
}

// Retrieve a document
const getDocument = async (req, res) => {
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
};

module.exports = { getDocument, createDocument };
