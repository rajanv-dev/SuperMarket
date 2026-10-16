const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/constants');

// ── Address sub-schema ────────────────────────────────────────────────────────
const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: 'Home' }, // Home, Work, etc.
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: {
      type: String,
      required: true,
      match: [/^\d{6}$/, 'Pincode must be a 6-digit number'],
    },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

// ── User schema ───────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\d{10}$/, 'Phone must be a 10-digit number'],
      sparse: true, // unique but nullable
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // never returned by default
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.CUSTOMER,
    },
    // For cashiers — which store they belong to
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
    },
    addresses: {
      type: [addressSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10,
        message: 'You cannot have more than 10 saved addresses',
      },
    },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    // Wishlist — array of product refs
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    passwordChangedAt: { type: Date },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ role: 1 });
userSchema.index({ storeId: 1 });

// ── Password helpers ──────────────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  // passwordHash field actually receives the plain text temporarily before hashing
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  this.passwordChangedAt = new Date();
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

/**
 * Returns true if the JWT was issued before the last password change.
 * @param {number} jwtIssuedAt - epoch seconds from the JWT `iat` claim
 */
userSchema.methods.passwordChangedAfter = function (jwtIssuedAt) {
  if (this.passwordChangedAt) {
    const changedAt = Math.floor(this.passwordChangedAt.getTime() / 1000);
    return jwtIssuedAt < changedAt;
  }
  return false;
};

// ── Safe JSON output (strip sensitive fields) ────────────────────────────────
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
