const { body, validationResult } = require('express-validator');
const { sendError } = require('../../utils/response');

// ── Re-usable validation chains ───────────────────────────────────────────────
const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name must be 100 characters or fewer'),

  body('email')
    .trim()
    .normalizeEmail()
    .isEmail().withMessage('Valid email is required'),

  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),

  body('phone')
    .optional()
    .matches(/^\d{10}$/).withMessage('Phone must be a 10-digit number'),
];

const loginValidation = [
  body('email').trim().normalizeEmail().isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
];

// ── Middleware to collect and return validation errors ─────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, {
      status: 422,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

module.exports = {
  registerValidation,
  loginValidation,
  changePasswordValidation,
  validate,
};
