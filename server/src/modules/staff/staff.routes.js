const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { protect, restrictTo } = require('../../middleware/auth');
const { supabaseServer } = require('../../config/supabase');
const { sendSuccess, sendError, paginationMeta } = require('../../utils/response');
const { ROLES } = require('../../config/constants');
const logger = require('../../utils/logger');

const router = express.Router();

// Require authenticated admin or manager role for staff operations
router.use(protect);
router.use(restrictTo(ROLES.ADMIN, ROLES.INVENTORY_MANAGER, 'manager'));

const SERVER_QR_SECRET =
  process.env.STAFF_QR_SECRET ||
  process.env.JWT_SECRET ||
  'vrk_supermarket_secure_staff_qr_token_key_2026_super_secret';

/**
 * Derives a cryptographically unguessable raw QR token from staff ID & salt
 */
const deriveStaffToken = (staffId, salt = 'v1') => {
  const rawHex = crypto
    .createHmac('sha256', SERVER_QR_SECRET)
    .update(`${staffId}:${salt}`)
    .digest('hex');
  return `VRK:STF:${rawHex}`;
};

/**
 * Hashes token using SHA-256 for secure database lookup and storage
 */
const hashToken = (token) => {
  const clean = token.startsWith('VRK:STF:') ? token.slice(8) : token;
  return crypto.createHash('sha256').update(clean).digest('hex');
};

/**
 * Generates next sequential human-readable staff ID (VRK-STF-0001, VRK-STF-0002, ...)
 */
const generateNextStaffCode = async () => {
  const { data: staffList } = await supabaseServer
    .from('staff')
    .select('staff_code')
    .ilike('staff_code', 'VRK-STF-%')
    .order('created_at', { ascending: false })
    .limit(100);

  let maxNum = 0;
  if (staffList && staffList.length > 0) {
    for (const s of staffList) {
      const match = s.staff_code?.match(/VRK-STF-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  }
  return `VRK-STF-${String(maxNum + 1).padStart(4, '0')}`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CREATE STAFF MEMBER (POST /api/staff)
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const { full_name, phone, email, role, department, date_of_joining, is_active } = req.body;

    if (!full_name || !full_name.trim()) {
      return sendError(res, { status: 400, message: 'Full name is required' });
    }
    if (!role || !role.trim()) {
      return sendError(res, { status: 400, message: 'Role or designation is required' });
    }

    // 1. Generate unique staff code
    const staffCode = await generateNextStaffCode();

    // 2. Prepare UUID and crypto salt
    const staffId = crypto.randomUUID();
    const qrSalt = crypto.randomBytes(16).toString('hex');
    const qrPayload = deriveStaffToken(staffId, qrSalt);
    const qrTokenHash = hashToken(qrPayload);

    const joiningDate = date_of_joining || new Date().toISOString().slice(0, 10);

    // 3. Insert staff into Supabase
    const { data: staff, error: insertErr } = await supabaseServer
      .from('staff')
      .insert({
        id: staffId,
        staff_code: staffCode,
        full_name: full_name.trim(),
        phone: phone ? phone.trim() : null,
        email: email ? email.trim().toLowerCase() : null,
        role: role.trim(),
        department: department ? department.trim() : 'Store Operations',
        date_of_joining: joiningDate,
        qr_token_hash: qrTokenHash,
        qr_salt: qrSalt,
        is_active: is_active !== undefined ? Boolean(is_active) : true,
      })
      .select()
      .single();

    if (insertErr) {
      logger.error('Failed to insert staff member:', insertErr);
      return sendError(res, { status: 500, message: insertErr.message || 'Database error creating staff' });
    }

    // 4. Generate high-resolution QR Code Data URL (PNG)
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 2,
      width: 400,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    return sendSuccess(res, {
      status: 201,
      message: 'Staff member created successfully',
      data: {
        ...staff,
        qr_payload: qrPayload,
        qr_data_url: qrDataUrl,
      },
    });
  } catch (err) {
    logger.error('Error creating staff:', err);
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. LIST ALL STAFF (GET /api/staff)
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { q, search, role, department, status, page = 1, limit = 50 } = req.query;
    const searchTerm = (q || search || '').trim();
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let query = supabaseServer.from('staff').select('*', { count: 'exact' });

    if (searchTerm) {
      query = query.or(
        `full_name.ilike.%${searchTerm}%,staff_code.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
      );
    }

    if (role && role !== 'all') {
      query = query.eq('role', role);
    }

    if (department && department !== 'all') {
      query = query.eq('department', department);
    }

    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data: staffList, error: queryErr, count } = await query;

    if (queryErr) {
      return sendError(res, { status: 500, message: queryErr.message });
    }

    // Check today's attendance status for each staff member
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
    }).format(new Date());

    const { data: todayAttendance } = await supabaseServer
      .from('attendance')
      .select('staff_id, check_in_at, status')
      .eq('attendance_date', todayStr);

    const attendanceMap = new Map();
    if (todayAttendance) {
      todayAttendance.forEach((att) => attendanceMap.set(att.staff_id, att));
    }

    const enrichedStaff = (staffList || []).map((s) => ({
      ...s,
      today_attendance: attendanceMap.get(s.id) || null,
      present_today: attendanceMap.has(s.id),
    }));

    return sendSuccess(res, {
      status: 200,
      data: enrichedStaff,
      meta: paginationMeta(count || 0, pageNum, limitNum),
    });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. GET SINGLE STAFF (GET /api/staff/:id)
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if id is UUID or staff_code
    let query = supabaseServer.from('staff').select('*');
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      query = query.eq('id', id);
    } else {
      query = query.eq('staff_code', id.toUpperCase());
    }

    const { data: staff, error: fetchErr } = await query.maybeSingle();

    if (fetchErr) return sendError(res, { status: 500, message: fetchErr.message });
    if (!staff) return sendError(res, { status: 404, message: 'Staff member not found' });

    // Fetch attendance history for this staff member (last 30 records)
    const { data: history } = await supabaseServer
      .from('attendance')
      .select('*')
      .eq('staff_id', staff.id)
      .order('attendance_date', { ascending: false })
      .limit(30);

    return sendSuccess(res, {
      status: 200,
      data: {
        staff,
        attendance_history: history || [],
      },
    });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. UPDATE STAFF (PATCH /api/staff/:id)
// ═══════════════════════════════════════════════════════════════════════════════
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, phone, email, role, department, date_of_joining, is_active } = req.body;

    const updates = {
      updated_at: new Date().toISOString(),
    };

    if (full_name !== undefined) updates.full_name = full_name.trim();
    if (phone !== undefined) updates.phone = phone ? phone.trim() : null;
    if (email !== undefined) updates.email = email ? email.trim().toLowerCase() : null;
    if (role !== undefined) updates.role = role.trim();
    if (department !== undefined) updates.department = department ? department.trim() : null;
    if (date_of_joining !== undefined) updates.date_of_joining = date_of_joining;
    if (is_active !== undefined) updates.is_active = Boolean(is_active);

    const { data: updatedStaff, error: updateErr } = await supabaseServer
      .from('staff')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (updateErr) return sendError(res, { status: 500, message: updateErr.message });
    if (!updatedStaff) return sendError(res, { status: 404, message: 'Staff member not found' });

    return sendSuccess(res, {
      status: 200,
      message: 'Staff details updated successfully',
      data: updatedStaff,
    });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. GET STAFF QR CODE (GET /api/staff/:id/qr)
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/:id/qr', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: staff, error: fetchErr } = await supabaseServer
      .from('staff')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) return sendError(res, { status: 500, message: fetchErr.message });
    if (!staff) return sendError(res, { status: 404, message: 'Staff member not found' });

    // Derive deterministic QR token payload
    const qrPayload = deriveStaffToken(staff.id, staff.qr_salt || 'v1');

    // Generate QR Data URL
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 2,
      width: 400,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    if (req.query.format === 'png') {
      const qrBuffer = await QRCode.toBuffer(qrPayload, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        margin: 2,
        width: 500,
      });
      res.setHeader('Content-Type', 'image/png');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${staff.staff_code}-${staff.full_name.replace(/\s+/g, '_')}-qr.png"`
      );
      return res.send(qrBuffer);
    }

    return sendSuccess(res, {
      status: 200,
      data: {
        staff_id: staff.id,
        staff_code: staff.staff_code,
        full_name: staff.full_name,
        role: staff.role,
        department: staff.department,
        is_active: staff.is_active,
        qr_payload: qrPayload,
        qr_data_url: qrDataUrl,
      },
    });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. REGENERATE QR CODE (POST /api/staff/:id/regenerate-qr)
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/:id/regenerate-qr', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: staff, error: fetchErr } = await supabaseServer
      .from('staff')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !staff) {
      return sendError(res, { status: 404, message: 'Staff member not found' });
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    const newPayload = deriveStaffToken(staff.id, newSalt);
    const newHash = hashToken(newPayload);

    const { data: updatedStaff, error: updateErr } = await supabaseServer
      .from('staff')
      .update({
        qr_salt: newSalt,
        qr_token_hash: newHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) return sendError(res, { status: 500, message: updateErr.message });

    const qrDataUrl = await QRCode.toDataURL(newPayload, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 2,
      width: 400,
    });

    return sendSuccess(res, {
      status: 200,
      message: 'Staff QR code regenerated and old QR revoked successfully',
      data: {
        ...updatedStaff,
        qr_payload: newPayload,
        qr_data_url: qrDataUrl,
      },
    });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

module.exports = {
  router,
  deriveStaffToken,
  hashToken,
};
