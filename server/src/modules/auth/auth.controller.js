const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');

// ── Helpers ───────────────────────────────────────────────────────────────────
const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const attachCookie = (res, token) => {
  const expiresInDays = parseInt(process.env.JWT_COOKIE_EXPIRES_IN || '7', 10);
  res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: expiresInDays * 24 * 60 * 60 * 1000,
  });
};

// ── POST /api/auth/register ───────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendError(res, { status: 409, message: 'Email already registered' });
    }

    // passwordHash field accepts plain text here; the pre-save hook hashes it
    const user = await User.create({ name, email, passwordHash: password, phone });

    const token = signToken(user._id);
    attachCookie(res, token);

    return sendSuccess(res, {
      status: 201,
      message: 'Registration successful',
      data: { user: user.toSafeObject(), token },
    });
  } catch (err) {
    logger.error(`register error: ${err.message}`);
    return sendError(res, { status: 500, message: 'Registration failed' });
  }
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // select: false on passwordHash — must explicitly include it
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !user.isActive) {
      return sendError(res, { status: 401, message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return sendError(res, { status: 401, message: 'Invalid email or password' });
    }

    const token = signToken(user._id);
    attachCookie(res, token);

    logger.info(`User logged in: ${user.email} (${user.role})`);

    return sendSuccess(res, {
      message: 'Login successful',
      data: { user: user.toSafeObject(), token },
    });
  } catch (err) {
    logger.error(`login error: ${err.message}`);
    return sendError(res, { status: 500, message: 'Login failed' });
  }
};

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
const logout = (req, res) => {
  res.cookie('jwt', 'logged_out', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 1000, // expire in 1 second
  });
  return sendSuccess(res, { message: 'Logged out successfully' });
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    // req.user is set by the protect middleware
    const user = await User.findById(req.user.id).populate('storeId', 'name');
    if (!user) return sendError(res, { status: 404, message: 'User not found' });
    return sendSuccess(res, { data: { user: user.toSafeObject() } });
  } catch (err) {
    logger.error(`getMe error: ${err.message}`);
    return sendError(res, { status: 500, message: 'Could not fetch profile' });
  }
};

// ── PATCH /api/auth/change-password ──────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+passwordHash');
    if (!user) return sendError(res, { status: 404, message: 'User not found' });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return sendError(res, { status: 401, message: 'Current password is incorrect' });
    }

    user.passwordHash = newPassword; // pre-save hook will hash it
    await user.save();

    // Invalidate old cookies by issuing a new token
    const token = signToken(user._id);
    attachCookie(res, token);

    return sendSuccess(res, { message: 'Password changed successfully', data: { token } });
  } catch (err) {
    logger.error(`changePassword error: ${err.message}`);
    return sendError(res, { status: 500, message: 'Password change failed' });
  }
};

module.exports = { register, login, logout, getMe, changePassword };
