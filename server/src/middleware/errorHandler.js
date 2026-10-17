const logger = require('../utils/logger');
const { sendError } = require('../utils/response');

// ── Global error handler ──────────────────────────────────────────────────────
// Must be the LAST middleware registered in app.js (4-argument signature)
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  let status = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  // ── Express-validator / Validation Error ───────────────────────────────────
  if (err.name === 'ValidationError' && err.errors) {
    status = 422;
    message = 'Validation failed';
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path || e.param,
      message: e.message || e.msg,
    }));
    return res.status(status).json({ success: false, message, errors });
  }

  // ── PostgreSQL / Supabase Duplicate Key (23505) ───────────────────────────
  if (err.code === '23505') {
    status = 409;
    message = err.detail || 'A record with this information already exists';
  }

  // ── PostgreSQL / Supabase Foreign Key Violation (23503) ───────────────────
  if (err.code === '23503') {
    status = 400;
    message = err.detail || 'Referenced record does not exist';
  }

  // ── PostgreSQL / Supabase Invalid Syntax / UUID (22P02) ───────────────────
  if (err.code === '22P02') {
    status = 400;
    message = 'Invalid identifier syntax or format';
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
    logger.error(err.stack || err.message);
  } else {
    logger.error(`${status} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  }

  // Never expose stack traces in production
  return sendError(res, { status, message });
};

module.exports = errorHandler;
