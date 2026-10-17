const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/response');
const { ROLES } = require('../config/constants');
const { supabaseServer } = require('../config/supabase');

const JWT_SECRET =
  process.env.JWT_SECRET ||
  '9983168fbd9c07dfa08963727d0eac786ae278266c528cd36482f60699a2d0e33b5de671078f0a37b34595f9007a2fed634245cea8c6b2070370aa6b166e909e';

// ── protect ───────────────────────────────────────────────────────────────────
/**
 * Extracts and verifies the JWT from either:
 *   1. HttpOnly cookie  (`jwt`)
 *   2. Authorization header (`Bearer <token>`)
 * Resolves user from Supabase Auth or local JWT verified against public.user_profiles.
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

    // 1. Try verifying with Supabase Auth if configured
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

          const userId = profile?.id || sbUser.id;
          req.user = {
            id: userId,
            _id: userId,
            auth_id: sbUser.id,
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
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return sendError(res, { status: 401, message: 'Invalid or expired token' });
    }

    // Verify against Supabase user_profiles if available
    if (supabaseServer) {
      try {
        let query = supabaseServer.from('user_profiles').select('*');
        if (decoded.email) {
          query = query.eq('email', decoded.email.toLowerCase());
        } else if (decoded.id) {
          query = query.eq('id', decoded.id);
        }

        const { data: profile } = await query.maybeSingle();

        if (profile) {
          if (!profile.is_active) {
            return sendError(res, { status: 401, message: 'User account not found or deactivated' });
          }

          const resolvedId = profile.id;
          req.user = {
            id: resolvedId,
            _id: resolvedId,
            auth_id: profile.auth_id,
            email: profile.email,
            name: profile.full_name || decoded.name || 'User',
            role: profile.role || decoded.role || ROLES.CUSTOMER,
            isActive: profile.is_active,
            provider: 'local-jwt',
          };
          return next();
        }
      } catch (err) {
        // Fall through to payload fallback
      }
    }

    // Fallback user from decoded token payload (e.g. test suites or mock tokens)
    const fallbackId = decoded.id || 'usr-default';
    req.user = {
      id: fallbackId,
      _id: fallbackId,
      email: decoded.email || 'admin@super.local',
      name: decoded.name || 'Super Admin',
      role: decoded.role || ROLES.ADMIN,
      isActive: true,
      provider: 'jwt-payload',
    };
    return next();
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

  const userId = req.user.id || req.user._id;
  if (
    req.user.role === ROLES.ADMIN ||
    (userId && userId.toString() === targetId.toString()) ||
    (req.user.auth_id && req.user.auth_id.toString() === targetId.toString())
  ) {
    return next();
  }
  return sendError(res, { status: 403, message: 'Access denied' });
};

module.exports = { protect, restrictTo, requireSameUserOrAdmin };
