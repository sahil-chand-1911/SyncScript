const mongoose = require('mongoose');

/**
 * Collaborator sub-schema for document access control.
 * Roles: 'editor' (can modify), 'viewer' (read-only).
 */
const collaboratorSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    email: { type: String, required: true },
    name: { type: String },
    role: {
      type: String,
      enum: ['editor', 'viewer'],
      default: 'viewer',
    },
  },
  { _id: false }
);

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
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null means the document was created before permissions existed
    },
    collaborators: [collaboratorSchema],
  },
  { timestamps: true }
);

/**
 * Instance method: determine a user's role for this document.
 * @param {string} userId - The user's MongoDB ObjectId as a string.
 * @returns {'owner' | 'editor' | 'viewer' | null}
 */
documentSchema.methods.getUserRole = function (userId) {
  if (this.owner && this.owner.toString() === userId) {
    return 'owner';
  }
  const collab = this.collaborators.find(
    (c) => c.userId.toString() === userId
  );
  if (collab) {
    return collab.role;
  }
  // Legacy documents without an owner are open to everyone as editors
  if (!this.owner) {
    return 'editor';
  }
  return null; // No access
};

module.exports = mongoose.model('Document', documentSchema);
