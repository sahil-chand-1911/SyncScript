const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    documentId: {
      type: String,
      required: true,
      unique: true,
    },
    data: {
      type: String, // Storing raw text/content
      default: '',
    },
    version: {
      type: Number,
      default: 1, // Store optimistic versions or simple save counts
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Document', documentSchema);
