const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class Collaborator extends Model {}

  Collaborator.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      documentId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
      },
      role: {
        type: DataTypes.ENUM('editor', 'viewer'),
        defaultValue: 'viewer',
      },
    },
    {
      sequelize,
      modelName: 'Collaborator',
      indexes: [
        {
          unique: true,
          fields: ['userId', 'documentId'],
        },
      ],
    }
  );

  return Collaborator;
};
