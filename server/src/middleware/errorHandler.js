const logger = require('../utils/logger');
const { sendError } = require('../utils/response');

// ── Global error handler ──────────────────────────────────────────────────────
// Must be the LAST middleware registered in app.js (4-argument signature)
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  let status = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  // ── Mongoose Validation Error ─────────────────────────────────────────────
  if (err.name === 'ValidationError') {
    status = 422;
    message = 'Validation failed';
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(status).json({ success: false, message, errors });
  }

  // ── Mongoose Duplicate Key ─────────────────────────────────────────────────
  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
  }

  // ── Mongoose CastError (invalid ObjectId) ────────────────────────────────
  if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // ── JWT Errors ────────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token';
  }
  if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token expired — please log in again';
  }

  // Log full error only in dev; in prod log just the essentials
  if (process.env.NODE_ENV !== 'production') {
    logger.error(err.stack);
  } else {
    logger.error(`${status} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  }

  // Never expose stack traces in production
  return sendError(res, { status, message });
};

module.exports = errorHandler;
