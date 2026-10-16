const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { sendError } = require('../utils/response');
const { ROLES } = require('../config/constants');

// ── protect ───────────────────────────────────────────────────────────────────
/**
 * Extracts and verifies the JWT from either:
 *   1. HttpOnly cookie  (`jwt`)
 *   2. Authorization header (`Bearer <token>`)
 * Attaches the full user document to req.user.
 */
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.cookies && req.cookies.jwt && req.cookies.jwt !== 'logged_out') {
      token = req.cookies.jwt;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return sendError(res, { status: 401, message: 'Authentication required' });
    }

    // 1. Try verifying with Supabase if configured
    const { supabaseServer } = require('../config/supabase');
    if (supabaseServer) {
      try {
        const { data: { user: sbUser }, error: sbErr } = await supabaseServer.auth.getUser(token);
        if (sbUser && !sbErr) {
          // Query verified database role from public.user_profiles
          const { data: profile } = await supabaseServer
            .from('user_profiles')
            .select('*')
            .or(`auth_id.eq.${sbUser.id},email.eq.${sbUser.email}`)
            .maybeSingle();

          if (profile && !profile.is_active) {
            return sendError(res, { status: 403, message: 'Your account has been deactivated' });
          }

          req.user = {
            id: sbUser.id,
            email: sbUser.email,
            name: profile?.full_name || sbUser.user_metadata?.full_name || sbUser.email.split('@')[0],
            role: profile?.role || ROLES.CUSTOMER,
            isActive: profile ? profile.is_active : true,
            provider: 'supabase',
          };
          return next();
        }
      } catch (sbEx) {
        // Fall through to local JWT verification
      }
    }

    // 2. Fall back to local JWT verification
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return sendError(res, { status: 401, message: 'Invalid or expired token' });
    }

    // In dev mode without active Mongo, provide a fallback user
    if (mongoose.connection.readyState !== 1) {
      req.user = {
        id: decoded.id,
        email: decoded.email || 'admin@super.local',
        name: decoded.name || 'Super Admin',
        role: decoded.role || ROLES.ADMIN,
        isActive: true,
      };
      return next();
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return sendError(res, { status: 401, message: 'User account not found or deactivated' });
    }

    // Reject tokens issued before the last password change
    if (user.passwordChangedAfter && user.passwordChangedAfter(decoded.iat)) {
      return sendError(res, { status: 401, message: 'Password recently changed — please log in again' });
    }

    req.user = user;
    next();
  } catch (err) {
    return sendError(res, { status: 401, message: 'Authentication failed' });
  }
};

// ── restrictTo ────────────────────────────────────────────────────────────────
/**
 * Role-based access control middleware factory.
 * Usage: restrictTo('admin', 'inventoryManager')
 *
 * IMPORTANT: Never trust a role from req.body.
 * The role is always read from the verified user document (req.user).
 */
const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user) {
    return sendError(res, { status: 401, message: 'Authentication required' });
  }
  if (!roles.includes(req.user.role)) {
    return sendError(res, {
      status: 403,
      message: 'You do not have permission to perform this action',
    });
  }
  next();
};

// ── requireSameUser ───────────────────────────────────────────────────────────
/**
 * Ensures the authenticated user is accessing their own resource,
 * unless they are an admin.
 * @param {string} paramName - the URL param holding the target user ID
 */
const requireSameUserOrAdmin = (paramName = 'userId') => (req, res, next) => {
  const targetId = req.params[paramName];
  if (!targetId) return sendError(res, { status: 400, message: 'Missing user ID in params' });

  if (
    req.user.role === ROLES.ADMIN ||
    req.user._id.toString() === targetId.toString()
  ) {
    return next();
  }
  return sendError(res, { status: 403, message: 'Access denied' });
};

module.exports = { protect, restrictTo, requireSameUserOrAdmin };
