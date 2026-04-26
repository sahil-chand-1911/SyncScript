const mongoose = require('mongoose');

/**
 * Stores snapshots of a document at specific version points.
 * Each entry represents the full document content at a given version,
 * along with metadata about who saved it and when.
 */
const documentVersionSchema = new mongoose.Schema(
  {
    documentId: {
      type: String,
      required: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
    },
    content: {
      type: String,
      default: '',
    },
    savedBy: {
      userId: { type: String },
      userName: { type: String },
    },
    label: {
      type: String,
      default: '', // Optional human-readable label like "Auto-save" or "Manual snapshot"
    },
  },
  { timestamps: true }
);

// Compound index to ensure unique versions per document and fast lookups
documentVersionSchema.index({ documentId: 1, version: -1 }, { unique: true });

module.exports = mongoose.model('DocumentVersion', documentVersionSchema);
