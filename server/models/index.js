const db = require('../config/db');

const sequelize = db.getSequelize();

const User = require('./User')(sequelize);
const Document = require('./Document')(sequelize);
const DocumentVersion = require('./DocumentVersion')(sequelize);
const Collaborator = require('./Collaborator')(sequelize);

// Associations
Document.hasMany(Collaborator, { foreignKey: 'documentId', sourceKey: 'documentId', as: 'Collaborators' });
Collaborator.belongsTo(Document, { foreignKey: 'documentId', targetKey: 'documentId' });

module.exports = {
  sequelize,
  User,
  Document,
  DocumentVersion,
  Collaborator,
};
