/**
 * Standardised API response helpers.
 * All responses follow the shape:
 *   { success, message, data?, meta? }
 *
 * Error responses also include:
 *   { success: false, message, errors? }
 */

const sendSuccess = (res, { status = 200, message = 'OK', data = null, meta = null } = {}) => {
  const body = { success: true, message };
  if (data !== null) body.data = data;
  if (meta !== null) body.meta = meta;
  return res.status(status).json(body);
};

const sendError = (res, { status = 500, message = 'Internal Server Error', errors = null } = {}) => {
  const body = { success: false, message };
  if (errors !== null) body.errors = errors;
  return res.status(status).json(body);
};

/**
 * Build pagination metadata from Mongoose query results.
 * @param {number} total   - total matching documents
 * @param {number} page    - current page (1-indexed)
 * @param {number} limit   - items per page
 */
const paginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  pages: Math.ceil(total / limit),
  hasNext: page * limit < total,
  hasPrev: page > 1,
});

module.exports = { sendSuccess, sendError, paginationMeta };
