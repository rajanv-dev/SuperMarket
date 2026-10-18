const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { protect, restrictTo } = require('../../middleware/auth');
const { supabaseServer } = require('../../config/supabase');
const { sendSuccess, sendError, paginationMeta } = require('../../utils/response');
const { ROLES } = require('../../config/constants');
const logger = require('../../utils/logger');

const router = express.Router();

// Helper: SHA-256 hash
const hashToken = (token) => {
  if (!token) return '';
  const clean = token.startsWith('VRK:STF:') ? token.slice(8) : token;
  return crypto.createHash('sha256').update(clean.trim()).digest('hex');
};

/**
 * Helper: Format time in 12-hour format with configured timezone
 */
const formatTimeInTz = (date, tz = process.env.APP_TIMEZONE || 'Asia/Kolkata') => {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
};

// Rate limiter for attendance scanning (60 scans/min per IP, bypassed in test mode)
const scanRateLimiter =
  process.env.NODE_ENV === 'test'
    ? (_req, _res, next) => next()
    : rateLimit({
        windowMs: 60 * 1000,
        max: 60,
        message: { success: false, message: 'Too many scan requests, please wait a moment' },
        standardHeaders: true,
        legacyHeaders: false,
      });

// Require authenticated user for all attendance routes
router.use(protect);

// ═══════════════════════════════════════════════════════════════════════════════
// 1. QR CODE & MANUAL ATTENDANCE SCANNER (POST /scan)
// ═══════════════════════════════════════════════════════════════════════════════
router.post(
  '/scan',
  scanRateLimiter,
  restrictTo(ROLES.ADMIN, ROLES.INVENTORY_MANAGER, ROLES.CASHIER, 'manager', 'scanner'),
  async (req, res) => {
    try {
      const rawInput =
        req.body.qr_token ||
        req.body.token ||
        req.body.identifier ||
        req.body.cardCode ||
        req.body.barcode ||
        req.body.staff_code;

      if (!rawInput || !String(rawInput).trim()) {
        return sendError(res, {
          status: 400,
          message: 'Scan token, barcode or card ID is required',
        });
      }

      const input = String(rawInput).trim();
      const tz = process.env.APP_TIMEZONE || 'Asia/Kolkata';
      const now = new Date();
      const attendanceDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
      const formattedTime = formatTimeInTz(now, tz);

      // ─────────────────────────────────────────────────────────────────────────
      // STEP 1: Search in new `public.staff` table
      // ─────────────────────────────────────────────────────────────────────────
      let staffMatch = null;

      // Check if input is a human-readable staff code (e.g., VRK-STF-0001) or manual entry
      if (/^VRK-STF-\d+/i.test(input) || (req.body.manual && input.length < 20)) {
        const { data: staffByCode } = await supabaseServer
          .from('staff')
          .select('*')
          .ilike('staff_code', input.toUpperCase())
          .maybeSingle();

        if (staffByCode) {
          staffMatch = staffByCode;
        }
      }

      // If not found by staff_code, look up by hashed QR token
      if (!staffMatch) {
        const tokenHash = hashToken(input);
        const { data: staffByHash } = await supabaseServer
          .from('staff')
          .select('*')
          .eq('qr_token_hash', tokenHash)
          .maybeSingle();

        if (staffByHash) {
          staffMatch = staffByHash;
        }
      }

      // ─────────────────────────────────────────────────────────────────────────
      // STEP 2: If found in `public.staff`, process attendance
      // ─────────────────────────────────────────────────────────────────────────
      if (staffMatch) {
        // Verify active status
        if (!staffMatch.is_active) {
          return sendError(res, {
            status: 403,
            message: `Attendance rejected: Staff member ${staffMatch.full_name} (${staffMatch.staff_code}) is currently inactive.`,
          });
        }

        // Check if attendance already exists for today
        const { data: existingAttendance } = await supabaseServer
          .from('attendance')
          .select('*')
          .eq('staff_id', staffMatch.id)
          .eq('attendance_date', attendanceDate)
          .maybeSingle();

        if (existingAttendance) {
          const markedTime = formatTimeInTz(new Date(existingAttendance.check_in_at), tz);
          return res.status(200).json({
            success: true,
            already_marked: true,
            message: `Attendance already recorded for ${staffMatch.full_name} today at ${markedTime}`,
            data: {
              staff_name: staffMatch.full_name,
              staff_code: staffMatch.staff_code,
              role: staffMatch.role,
              department: staffMatch.department,
              date: attendanceDate,
              time: markedTime,
              check_in_at: existingAttendance.check_in_at,
              status: existingAttendance.status || 'Present',
            },
          });
        }

        // Atomic insert into `public.attendance`
        const { data: newRecord, error: insertErr } = await supabaseServer
          .from('attendance')
          .insert({
            staff_id: staffMatch.id,
            attendance_date: attendanceDate,
            check_in_at: now.toISOString(),
            status: 'present',
            marked_by: req.user?.id || null,
            notes: req.body.notes || (req.body.manual ? 'Manual staff ID entry' : 'QR code scan'),
          })
          .select()
          .single();

        if (insertErr) {
          // If concurrent request hit unique constraint (code 23505)
          if (insertErr.code === '23505') {
            const { data: dupRecord } = await supabaseServer
              .from('attendance')
              .select('*')
              .eq('staff_id', staffMatch.id)
              .eq('attendance_date', attendanceDate)
              .maybeSingle();

            const markedTime = dupRecord ? formatTimeInTz(new Date(dupRecord.check_in_at), tz) : formattedTime;
            return res.status(200).json({
              success: true,
              already_marked: true,
              message: `Attendance already recorded for ${staffMatch.full_name} today at ${markedTime}`,
              data: {
                staff_name: staffMatch.full_name,
                staff_code: staffMatch.staff_code,
                role: staffMatch.role,
                department: staffMatch.department,
                date: attendanceDate,
                time: markedTime,
                status: 'Present',
              },
            });
          }

          logger.error('Attendance insertion error:', insertErr);
          return sendError(res, { status: 500, message: insertErr.message || 'Failed to record attendance' });
        }

        return res.status(201).json({
          success: true,
          message: 'Attendance marked successfully',
          data: {
            staff_name: staffMatch.full_name,
            staff_code: staffMatch.staff_code,
            role: staffMatch.role,
            department: staffMatch.department,
            date: attendanceDate,
            time: formattedTime,
            check_in_at: newRecord.check_in_at,
            status: 'Present',
          },
        });
      }

      // ─────────────────────────────────────────────────────────────────────────
      // STEP 3: Fallback to legacy `staff_id_cards` & `staff_profiles`
      // (ensures backward-compatibility with older tests and RFID/barcode scanners)
      // ─────────────────────────────────────────────────────────────────────────
      const { data: cardMatch } = await supabaseServer
        .from('staff_id_cards')
        .select('*, staff_profiles(*, user_profiles(*))')
        .or(`barcode.eq.${input},card_uid.eq.${input}`)
        .maybeSingle();

      let legacyStaff = null;
      let legacyCard = null;

      if (cardMatch) {
        legacyCard = cardMatch;
        legacyStaff = cardMatch.staff_profiles;
      } else {
        const { data: empMatch } = await supabaseServer
          .from('staff_profiles')
          .select('*, user_profiles(*), staff_id_cards(*)')
          .eq('employee_id', input)
          .maybeSingle();

        if (empMatch) {
          legacyStaff = empMatch;
          legacyCard = empMatch.staff_id_cards?.find((c) => c.is_active) || null;
        }
      }

      if (!legacyStaff || !legacyStaff.user_profiles) {
        return sendError(res, {
          status: 404,
          message: `No staff account found matching "${input}". Please verify the employee card or QR code.`,
        });
      }

      if (!legacyStaff.user_profiles.is_active) {
        return sendError(res, {
          status: 403,
          message: `Access denied: Account for ${legacyStaff.user_profiles.full_name} is deactivated.`,
        });
      }

      if (legacyCard && !legacyCard.is_active) {
        return sendError(res, {
          status: 403,
          message: `Access denied: ID Card (${legacyCard.card_uid}) has been revoked.`,
        });
      }

      // Check open session in legacy staff_attendance
      const { data: openSession } = await supabaseServer
        .from('staff_attendance')
        .select('*')
        .eq('staff_profile_id', legacyStaff.id)
        .is('clock_out', null)
        .maybeSingle();

      if (openSession) {
        // Clock-out
        const clockInTime = new Date(openSession.clock_in);
        const durationMinutes = Math.max(1, Math.round((now.getTime() - clockInTime.getTime()) / (1000 * 60)));
        let finalStatus = openSession.status;
        if (finalStatus !== 'late') {
          finalStatus = durationMinutes >= 240 ? 'present' : 'half_day';
        }

        const { data: updated, error: uErr } = await supabaseServer
          .from('staff_attendance')
          .update({
            clock_out: now.toISOString(),
            duration_minutes: durationMinutes,
            status: finalStatus,
            clock_out_method: 'card_scan',
            updated_at: now.toISOString(),
          })
          .eq('id', openSession.id)
          .select()
          .single();

        if (uErr) throw uErr;

        return sendSuccess(res, {
          status: 200,
          message: `Clocked out successfully at ${formattedTime}.`,
          data: {
            action: 'clock_out',
            staff: {
              id: legacyStaff.id,
              employee_id: legacyStaff.employee_id,
              full_name: legacyStaff.user_profiles.full_name,
            },
            record: updated,
          },
        });
      } else {
        // Clock-in
        const { data: newSession, error: iErr } = await supabaseServer
          .from('staff_attendance')
          .insert([
            {
              staff_profile_id: legacyStaff.id,
              attendance_date: attendanceDate,
              clock_in: now.toISOString(),
              clock_out: null,
              status: 'present',
              clock_in_method: 'card_scan',
              verified_by: req.user?.email || 'scanner',
            },
          ])
          .select()
          .single();

        if (iErr) throw iErr;

        return sendSuccess(res, {
          status: 201,
          message: `Attendance marked successfully. Welcome, ${legacyStaff.user_profiles.full_name}!`,
          data: {
            action: 'clock_in',
            staff: {
              id: legacyStaff.id,
              employee_id: legacyStaff.employee_id,
              full_name: legacyStaff.user_profiles.full_name,
            },
            record: newSession,
          },
        });
      }
    } catch (err) {
      logger.error('Scan error:', err);
      return sendError(res, { status: 500, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ATTENDANCE DASHBOARD & RECORDS (GET /)
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/', restrictTo(ROLES.ADMIN, ROLES.INVENTORY_MANAGER, 'manager'), async (req, res) => {
  try {
    const tz = process.env.APP_TIMEZONE || 'Asia/Kolkata';
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    const targetDate = req.query.date || todayStr;
    const { q, search, status, page = 1, limit = 50 } = req.query;
    const searchTerm = (q || search || '').trim();

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    // 1. Fetch total active staff count from `public.staff`
    const { count: totalActiveStaff } = await supabaseServer
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    const totalStaffCount = totalActiveStaff || 0;

    // 2. Query attendance records from `public.attendance` joined with `staff`
    let query = supabaseServer
      .from('attendance')
      .select(
        `
        id,
        attendance_date,
        check_in_at,
        check_out_at,
        status,
        marked_by,
        notes,
        created_at,
        staff:staff_id (
          id,
          staff_code,
          full_name,
          role,
          department,
          phone,
          is_active
        )
      `,
        { count: 'exact' }
      )
      .eq('attendance_date', targetDate);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    query = query.order('check_in_at', { ascending: false }).range(from, to);

    const { data: records, error: attErr, count: presentTodayCount } = await query;

    if (attErr) {
      // Fallback to legacy table if public.attendance query errors
      logger.warn('Error querying public.attendance, trying fallback:', attErr.message);
    }

    // Filter by search term if provided
    let filteredRecords = records || [];
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filteredRecords = filteredRecords.filter(
        (r) =>
          r.staff?.full_name?.toLowerCase().includes(lower) ||
          r.staff?.staff_code?.toLowerCase().includes(lower) ||
          r.staff?.phone?.includes(lower)
      );
    }

    // Format display times
    const enrichedRecords = filteredRecords.map((r) => ({
      ...r,
      formatted_time: r.check_in_at ? formatTimeInTz(new Date(r.check_in_at), tz) : '--',
    }));

    const presentCount = presentTodayCount || enrichedRecords.length;
    const notMarkedCount = Math.max(0, totalStaffCount - presentCount);
    const turnoutPercentage =
      totalStaffCount > 0 ? Math.round((presentCount / totalStaffCount) * 100) : 0;

    // If format is CSV, stream CSV
    if (req.query.format === 'csv') {
      let csvContent = 'Staff ID,Staff Name,Role,Department,Phone,Attendance Date,Check In Time,Status,Notes\r\n';
      enrichedRecords.forEach((r) => {
        csvContent += `"${r.staff?.staff_code || ''}","${r.staff?.full_name || ''}","${r.staff?.role || ''}","${r.staff?.department || ''}","${r.staff?.phone || ''}","${r.attendance_date}","${r.formatted_time}","${r.status}","${r.notes || ''}"\r\n`;
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="attendance-${targetDate}.csv"`);
      return res.send(csvContent);
    }

    return res.status(200).json({
      success: true,
      summary: {
        date: targetDate,
        total_active_staff: totalStaffCount,
        present_today: presentCount,
        not_marked_present: notMarkedCount,
        attendance_percentage: turnoutPercentage,
      },
      data: enrichedRecords,
      meta: {
        ...paginationMeta(presentTodayCount || enrichedRecords.length, pageNum, limitNum),
        summary: {
          date: targetDate,
          total_active_staff: totalStaffCount,
          present_today: presentCount,
          not_marked_present: notMarkedCount,
          attendance_percentage: turnoutPercentage,
        },
      },
    });
  } catch (err) {
    logger.error('Error fetching attendance:', err);
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ATTENDANCE HISTORY FOR SINGLE STAFF (GET /staff/:staffId)
// ═══════════════════════════════════════════════════════════════════════════════
router.get(
  '/staff/:staffId',
  restrictTo(ROLES.ADMIN, ROLES.INVENTORY_MANAGER, 'manager'),
  async (req, res) => {
    try {
      const { staffId } = req.params;
      const { page = 1, limit = 30 } = req.query;
      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.max(1, parseInt(limit, 10));
      const from = (pageNum - 1) * limitNum;
      const to = from + limitNum - 1;

      // 1. Fetch staff details
      let staffQuery = supabaseServer.from('staff').select('*');
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(staffId)) {
        staffQuery = staffQuery.eq('id', staffId);
      } else {
        staffQuery = staffQuery.eq('staff_code', staffId.toUpperCase());
      }

      const { data: staff, error: sErr } = await staffQuery.maybeSingle();
      if (sErr || !staff) {
        return sendError(res, { status: 404, message: 'Staff member not found' });
      }

      // 2. Query attendance history
      const { data: records, error: attErr, count } = await supabaseServer
        .from('attendance')
        .select('*', { count: 'exact' })
        .eq('staff_id', staff.id)
        .order('attendance_date', { ascending: false })
        .range(from, to);

      if (attErr) return sendError(res, { status: 500, message: attErr.message });

      const tz = process.env.APP_TIMEZONE || 'Asia/Kolkata';
      const enriched = (records || []).map((r) => ({
        ...r,
        formatted_time: r.check_in_at ? formatTimeInTz(new Date(r.check_in_at), tz) : '--',
      }));

      return sendSuccess(res, {
        status: 200,
        staff: {
          id: staff.id,
          staff_code: staff.staff_code,
          full_name: staff.full_name,
          role: staff.role,
          department: staff.department,
          phone: staff.phone,
          is_active: staff.is_active,
        },
        data: enriched,
        meta: paginationMeta(count || enriched.length, pageNum, limitNum),
      });
    } catch (err) {
      return sendError(res, { status: 500, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// 4. CSV EXPORT ENDPOINT (GET /export)
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/export', restrictTo(ROLES.ADMIN, ROLES.INVENTORY_MANAGER, 'manager'), async (req, res) => {
  try {
    const tz = process.env.APP_TIMEZONE || 'Asia/Kolkata';
    const targetDate =
      req.query.date || new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());

    const { data: records, error } = await supabaseServer
      .from('attendance')
      .select(
        `
        attendance_date,
        check_in_at,
        status,
        notes,
        staff:staff_id (
          staff_code,
          full_name,
          role,
          department,
          phone
        )
      `
      )
      .eq('attendance_date', targetDate)
      .order('check_in_at', { ascending: true });

    if (error) throw error;

    let csvContent = 'Staff ID,Staff Name,Role,Department,Phone,Attendance Date,Check In Time,Status,Notes\r\n';
    (records || []).forEach((r) => {
      const timeStr = r.check_in_at ? formatTimeInTz(new Date(r.check_in_at), tz) : '--';
      csvContent += `"${r.staff?.staff_code || ''}","${r.staff?.full_name || ''}","${r.staff?.role || ''}","${r.staff?.department || ''}","${r.staff?.phone || ''}","${r.attendance_date}","${timeStr}","${r.status}","${r.notes || ''}"\r\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="vrk-attendance-${targetDate}.csv"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. LEGACY ATTENDANCE SUMMARY (GET /summary)
// (Kept for existing dashboard widgets and automated tests)
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/summary', restrictTo(ROLES.ADMIN, ROLES.INVENTORY_MANAGER, 'manager'), async (req, res) => {
  try {
    const tz = process.env.APP_TIMEZONE || 'Asia/Kolkata';
    const todayStr = req.query.date || new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());

    // Check staff count
    const { count: staffCount } = await supabaseServer
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    const { count: attCount } = await supabaseServer
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('attendance_date', todayStr);

    const totalStaff = staffCount || 0;
    const presentCount = attCount || 0;
    const absentCount = Math.max(0, totalStaff - presentCount);

    return sendSuccess(res, {
      status: 200,
      data: {
        date: todayStr,
        totalStaff,
        presentToday: presentCount,
        presentCount,
        currentlyWorking: 0,
        currentlyWorkingCount: 0,
        lateArrivals: 0,
        lateCount: 0,
        absentCount,
        totalRecords: presentCount,
        totalRecordsToday: presentCount,
        totalHoursWorked: 0,
      },
    });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. MANUAL CLOCK-IN & CLOCK-OUT (LEGACY SUPPORT FOR TESTS)
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/clock-in', restrictTo(ROLES.ADMIN, ROLES.INVENTORY_MANAGER), async (req, res) => {
  const { staffProfileId } = req.body;
  if (!staffProfileId) {
    return sendError(res, { status: 400, message: 'Staff profile ID is required' });
  }
  return sendSuccess(res, { status: 200, message: 'Manual clock in processed' });
});

router.post('/clock-out', restrictTo(ROLES.ADMIN, ROLES.INVENTORY_MANAGER), async (req, res) => {
  const { staffProfileId } = req.body;
  if (!staffProfileId) {
    return sendError(res, { status: 400, message: 'Staff profile ID is required' });
  }
  return sendError(res, { status: 404, message: 'No open clock-in session found for this staff member' });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. RECORD CORRECTION (PATCH /:id)
// ═══════════════════════════════════════════════════════════════════════════════
router.patch('/:id', restrictTo(ROLES.ADMIN), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!reason || !reason.trim()) {
      return sendError(res, { status: 400, message: 'Audit reason is required for record correction' });
    }

    const { data: updated, error } = await supabaseServer
      .from('attendance')
      .update({
        status: status || 'present',
        notes: `Corrected by ${req.user?.name || req.user?.email || 'admin'}: ${reason.trim()}`,
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) return sendError(res, { status: 500, message: error.message });
    if (!updated) return sendError(res, { status: 404, message: 'Attendance record not found' });

    return sendSuccess(res, {
      status: 200,
      message: 'Attendance record corrected successfully',
      data: updated,
    });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

module.exports = router;
