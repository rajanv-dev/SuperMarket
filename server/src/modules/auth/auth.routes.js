const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  register,
  login,
  logout,
  getMe,
  changePassword,
} = require('./auth.controller');
const {
  registerValidation,
  loginValidation,
  changePasswordValidation,
  validate,
} = require('./auth.validation');
const { protect } = require('../../middleware/auth');

const router = express.Router();

// ── Rate limiter for sensitive auth endpoints (disabled in test suite) ─────────
const authLimiter =
  process.env.NODE_ENV === 'test'
    ? (_req, _res, next) => next()
    : rateLimit({
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
        max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
        message: { success: false, message: 'Too many attempts, please try again later' },
        standardHeaders: true,
        legacyHeaders: false,
      });

router.post('/register', authLimiter, registerValidation, validate, register);
router.post('/login', authLimiter, loginValidation, validate, login);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.patch('/change-password', protect, changePasswordValidation, validate, changePassword);

module.exports = router;
