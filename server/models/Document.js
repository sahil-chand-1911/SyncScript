const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class Document extends Model {
    /**
     * Instance method: determine a user's role for this document.
     * @param {string} userId - The user's UUID as a string.
     * @returns {'owner' | 'editor' | 'viewer' | null}
     */
    getUserRole(userId) {
      if (this.ownerId && this.ownerId === userId) {
        return 'owner';
      }
      
      // Assumes Collaborators have been eager-loaded
      if (this.Collaborators && this.Collaborators.length > 0) {
        const collab = this.Collaborators.find((c) => c.userId === userId);
        if (collab) {
          return collab.role;
        }
      }

      // Legacy documents without an owner are open to everyone as editors
      if (!this.ownerId) {
        return 'editor';
      }
      return null; // No access
    }
  }

  Document.init(
    {
      documentId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        primaryKey: true,
      },
      data: {
        type: DataTypes.TEXT,
        defaultValue: '',
      },
      version: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
      },
      ownerId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Document',
    }
  );

  return Document;
};
