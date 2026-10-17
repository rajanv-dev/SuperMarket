const jwt = require('jsonwebtoken');
const { supabaseServer } = require('../../config/supabase');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const { ROLES } = require('../../config/constants');

const JWT_SECRET =
  process.env.JWT_SECRET ||
  '9983168fbd9c07dfa08963727d0eac786ae278266c528cd36482f60699a2d0e33b5de671078f0a37b34595f9007a2fed634245cea8c6b2070370aa6b166e909e';

// ── Helpers ───────────────────────────────────────────────────────────────────
const signToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, {
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
    if (!supabaseServer) {
      return sendError(res, { status: 503, message: 'Database service unavailable' });
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (name || '').trim();
    const cleanPhone = phone ? phone.trim() : null;

    // Check if user profile already exists
    const { data: existingUser } = await supabaseServer
      .from('user_profiles')
      .select('id, email')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingUser) {
      return sendError(res, { status: 409, message: 'Email already registered' });
    }

    let authId = null;
    let profile = null;
    let token = null;

    // 1. Try atomic PostgreSQL account registration (sets auth.users, identities, and user_profiles)
    try {
      const { data: rpcRes, error: rpcErr } = await supabaseServer.rpc('register_user_account', {
        p_email: cleanEmail,
        p_password: password,
        p_full_name: cleanName,
        p_phone: cleanPhone || null,
      });

      if (!rpcErr && rpcRes?.success) {
        authId = rpcRes.user_id;
        profile = rpcRes.profile;
      } else if (rpcRes?.code === 'EMAIL_EXISTS') {
        return sendError(res, { status: 409, message: 'Email already registered' });
      }
    } catch (rpcEx) {
      logger.warn(`register_user_account RPC note: ${rpcEx.message}`);
    }

    // 2. Fallback to direct user_profiles insert if RPC was unavailable
    if (!profile) {
      const { data: pData, error: pErr } = await supabaseServer
        .from('user_profiles')
        .upsert(
          {
            auth_id: authId,
            email: cleanEmail,
            full_name: cleanName,
            phone: cleanPhone,
            role: ROLES.CUSTOMER,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'email' }
        )
        .select()
        .single();

      if (pErr) {
        logger.error(`Failed to create user profile: ${pErr.message}`);
        return sendError(res, { status: 500, message: 'Registration failed to create profile' });
      }
      profile = pData;
    }

    // 3. Attempt signInWithPassword to obtain verified Supabase session token
    try {
      const { data: loginRes } = await supabaseServer.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (loginRes?.session?.access_token) {
        token = loginRes.session.access_token;
      }
    } catch {}

    // Fallback JWT if Supabase session token wasn't returned
    if (!token) {
      token = signToken({
        id: profile.id,
        auth_id: authId,
        email: profile.email,
        name: profile.full_name,
        role: profile.role,
      });
    }

    attachCookie(res, token);

    const safeUser = {
      id: profile.id,
      _id: profile.id,
      auth_id: authId,
      name: profile.full_name,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
      isActive: profile.is_active,
    };

    return sendSuccess(res, {
      status: 201,
      message: 'Registration successful',
      data: { user: safeUser, token },
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
    if (!supabaseServer) {
      return sendError(res, { status: 503, message: 'Database service unavailable' });
    }

    const cleanEmail = (email || '').trim().toLowerCase();

    // 1. Try Supabase Auth password authentication
    let token = null;
    let authUserId = null;

    try {
      const { data: sbData, error: sbErr } = await supabaseServer.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (!sbErr && sbData?.session) {
        token = sbData.session.access_token;
        authUserId = sbData.user.id;
      }
    } catch (err) {
      // Continue to check profile and seed admin
    }

    // 2. Query user profile
    const { data: profile } = await supabaseServer
      .from('user_profiles')
      .select('*')
      .eq('email', cleanEmail)
      .maybeSingle();

    // 3. Fallback check for seed admin credentials
    const seedEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@super.local').toLowerCase().trim();
    const seedPass = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
    const isSeedAdmin = cleanEmail === seedEmail && password === seedPass;

    if (!token && isSeedAdmin) {
      token = signToken({
        id: profile?.id || 'admin-seed-id',
        email: cleanEmail,
        name: profile?.full_name || 'Super Admin',
        role: ROLES.ADMIN,
      });
    }

    if (!token) {
      return sendError(res, { status: 401, message: 'Invalid email or password' });
    }

    if (profile && !profile.is_active) {
      return sendError(res, { status: 403, message: 'Your account has been deactivated' });
    }

    attachCookie(res, token);
    const userRole = profile?.role || (isSeedAdmin ? ROLES.ADMIN : ROLES.CUSTOMER);
    logger.info(`User logged in: ${cleanEmail} (${userRole})`);

    const safeUser = {
      id: profile?.id || authUserId || 'user',
      _id: profile?.id || authUserId || 'user',
      auth_id: profile?.auth_id || authUserId,
      name: profile?.full_name || (isSeedAdmin ? 'Super Admin' : cleanEmail.split('@')[0]),
      email: cleanEmail,
      phone: profile?.phone || null,
      role: userRole,
      isActive: profile ? profile.is_active : true,
    };

    return sendSuccess(res, {
      message: 'Login successful',
      data: { user: safeUser, token },
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
    maxAge: 1000,
  });
  return sendSuccess(res, { message: 'Logged out successfully' });
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return sendError(res, { status: 401, message: 'Authentication required' });
    }

    if (!supabaseServer) {
      return sendSuccess(res, { data: { user: req.user } });
    }

    const { data: profile } = await supabaseServer
      .from('user_profiles')
      .select('*')
      .or(`id.eq.${req.user.id},email.eq.${req.user.email}`)
      .maybeSingle();

    const safeUser = {
      id: profile?.id || req.user.id,
      _id: profile?.id || req.user.id,
      auth_id: profile?.auth_id || req.user.auth_id,
      name: profile?.full_name || req.user.name,
      email: profile?.email || req.user.email,
      phone: profile?.phone || req.user.phone,
      role: profile?.role || req.user.role,
      isActive: profile ? profile.is_active : true,
    };

    return sendSuccess(res, { data: { user: safeUser } });
  } catch (err) {
    logger.error(`getMe error: ${err.message}`);
    return sendError(res, { status: 500, message: 'Could not fetch profile' });
  }
};

// ── PATCH /api/auth/change-password ──────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!supabaseServer) {
      return sendError(res, { status: 503, message: 'Database service unavailable' });
    }

    // Verify current credentials
    const seedEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@super.local').toLowerCase().trim();
    const seedPass = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
    const isSeedAdminMatch = req.user.email === seedEmail && currentPassword === seedPass;

    if (!isSeedAdminMatch) {
      const { error: verifyErr } = await supabaseServer.auth.signInWithPassword({
        email: req.user.email,
        password: currentPassword,
      });

      if (verifyErr) {
        return sendError(res, { status: 401, message: 'Current password is incorrect' });
      }
    }

    // Try updating Supabase Auth password if admin client available
    try {
      if (req.user.auth_id && supabaseServer.auth.admin) {
        await supabaseServer.auth.admin.updateUserById(req.user.auth_id, {
          password: newPassword,
        });
      }
    } catch (err) {
      logger.warn(`Could not update Supabase auth password: ${err.message}`);
    }

    const newToken = signToken({
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
    });
    attachCookie(res, newToken);

    return sendSuccess(res, {
      message: 'Password changed successfully',
      data: { token: newToken },
    });
  } catch (err) {
    logger.error(`changePassword error: ${err.message}`);
    return sendError(res, { status: 500, message: 'Password change failed' });
  }
};

module.exports = { register, login, logout, getMe, changePassword };
