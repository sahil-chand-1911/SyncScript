const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

/**
 * User Schema for authentication.
 * Stores name, email, and a bcrypt-hashed password.
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
    },
  },
  { timestamps: true }
);

/**
 * Pre-save hook to hash the password before persisting.
 * Only hashes if the password field has been modified (avoids re-hashing on updates).
 */
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Instance method to compare a candidate password with the stored hash.
 * @param {string} candidatePassword - The plain-text password to verify.
 * @returns {Promise<boolean>} True if the password matches.
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
