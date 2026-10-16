const express = require('express');
const { protect, restrictTo } = require('../../middleware/auth');
const { supabaseServer } = require('../../config/supabase');
const { sendSuccess, sendError, paginationMeta } = require('../../utils/response');
const { ROLES } = require('../../config/constants');

const router = express.Router();

// Attendance routes require manager or admin role
router.use(protect);
router.use(restrictTo(ROLES.ADMIN, ROLES.INVENTORY_MANAGER, 'manager'));

/**
 * Helper: Format time in HH:MM format
 */
const formatTime = (date) => {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. ATTENDANCE SUMMARY (TODAY)
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/summary', async (req, res) => {
  try {
    const todayStr = req.query.date || new Date().toISOString().slice(0, 10);

    // 1. Fetch all active staff
    const { data: staffList, error: sErr } = await supabaseServer
      .from('staff_profiles')
      .select('id, employee_id, user_profiles!inner(id, full_name, email, role, is_active)')
      .eq('user_profiles.is_active', true);

    if (sErr) throw sErr;

    const totalStaff = staffList?.length || 0;

    // 2. Fetch today's attendance records
    const { data: attendanceList, error: aErr } = await supabaseServer
      .from('staff_attendance')
      .select('*')
      .eq('attendance_date', todayStr);

    if (aErr) throw aErr;

    const records = attendanceList || [];
    const presentStaffIds = new Set(records.map((r) => r.staff_profile_id));
    const presentCount = presentStaffIds.size;
    const workingCount = records.filter((r) => r.clock_out === null).length;
    const lateCount = records.filter((r) => r.status === 'late').length;
    const absentCount = Math.max(0, totalStaff - presentCount);

    const totalDurationMinutes = records.reduce((sum, r) => sum + (Number(r.duration_minutes) || 0), 0);
    const totalHoursWorked = Math.round((totalDurationMinutes / 60) * 10) / 10;

    return sendSuccess(res, {
      status: 200,
      data: {
        date: todayStr,
        totalStaff,
        presentToday: presentCount,
        presentCount,
        currentlyWorking: workingCount,
        currentlyWorkingCount: workingCount,
        lateArrivals: lateCount,
        lateCount,
        absentCount,
        totalRecords: records.length,
        totalRecordsToday: records.length,
        totalHoursWorked,
      },
    });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ATTENDANCE RECORDS LIST
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { date, staffId, status, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let query = supabaseServer
      .from('staff_attendance')
      .select(
        `
        *,
        staff_profiles!inner(
          id,
          employee_id,
          department,
          designation,
          user_profiles!inner(
            id,
            full_name,
            email,
            phone,
            role,
            is_active
          )
        )
      `,
        { count: 'exact' }
      )
      .order('clock_in', { ascending: false });

    if (date) {
      query = query.eq('attendance_date', date);
    }
    if (staffId && staffId !== 'all') {
      query = query.eq('staff_profile_id', staffId);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query.range(from, to);
    if (error) throw error;

    const meta = paginationMeta(count || 0, pageNum, limitNum);
    return sendSuccess(res, {
      status: 200,
      data: data || [],
      meta,
      pagination: meta,
    });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. STAFF LIST WITH ATTENDANCE STATUS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/staff', async (req, res) => {
  try {
    const todayStr = req.query.date || new Date().toISOString().slice(0, 10);

    // Fetch all staff profiles with user details and cards
    const { data: staffList, error: sErr } = await supabaseServer
      .from('staff_profiles')
      .select(
        `
        *,
        user_profiles!inner(
          id,
          full_name,
          email,
          phone,
          role,
          is_active
        ),
        staff_id_cards(
          id,
          card_uid,
          barcode,
          is_active,
          issued_at
        )
      `
      )
      .order('employee_id', { ascending: true });

    if (sErr) throw sErr;

    // Fetch today's attendance for status mapping
    const { data: todayAttendance } = await supabaseServer
      .from('staff_attendance')
      .select('*')
      .eq('attendance_date', todayStr);

    const attendanceMap = {};
    (todayAttendance || []).forEach((att) => {
      // If open session or latest, map it
      if (!attendanceMap[att.staff_profile_id] || att.clock_out === null) {
        attendanceMap[att.staff_profile_id] = att;
      }
    });

    const enriched = (staffList || []).map((staff) => {
      const activeCard = staff.staff_id_cards?.find((c) => c.is_active);
      const att = attendanceMap[staff.id];
      let currentStatus = 'not_recorded';

      if (att) {
        if (att.clock_out === null) {
          currentStatus = 'working';
        } else {
          currentStatus = att.status;
        }
      }

      return {
        ...staff,
        active_card: activeCard || null,
        today_attendance: att || null,
        attendance_status: currentStatus,
      };
    });

    return sendSuccess(res, { status: 200, data: enriched });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ID CARD SCANNER (CLOCK-IN / CLOCK-OUT TOGGLE)
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/scan', async (req, res) => {
  try {
    const identifier = req.body.identifier || req.body.cardCode || req.body.barcode;
    const method = req.body.method || 'card_scan';

    if (!identifier || !identifier.trim()) {
      return sendError(res, { status: 400, message: 'Scan barcode or card ID is required' });
    }

    const cleanId = identifier.trim();

    // 1. Find staff member by Card Barcode, Card UID, or Employee ID
    // First check staff_id_cards
    const { data: cardMatch } = await supabaseServer
      .from('staff_id_cards')
      .select('*, staff_profiles(*, user_profiles(*))')
      .or(`barcode.eq.${cleanId},card_uid.eq.${cleanId}`)
      .maybeSingle();

    let staff = null;
    let card = null;

    if (cardMatch) {
      card = cardMatch;
      staff = cardMatch.staff_profiles;
    } else {
      // Fallback: search by employee_id directly
      const { data: empMatch } = await supabaseServer
        .from('staff_profiles')
        .select('*, user_profiles(*), staff_id_cards(*)')
        .eq('employee_id', cleanId)
        .maybeSingle();

      if (empMatch) {
        staff = empMatch;
        card = empMatch.staff_id_cards?.find((c) => c.is_active) || null;
      }
    }

    if (!staff || !staff.user_profiles) {
      return sendError(res, {
        status: 404,
        message: `No staff account found matching "${cleanId}". Please verify the employee card.`,
      });
    }

    // 2. Validate staff and card status
    if (!staff.user_profiles.is_active) {
      return sendError(res, {
        status: 403,
        message: `Access denied: Account for ${staff.user_profiles.full_name} is deactivated.`,
      });
    }

    if (card && !card.is_active) {
      return sendError(res, {
        status: 403,
        message: `Access denied: ID Card (${card.card_uid}) has been revoked.`,
      });
    }

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const timeFormatted = formatTime(now);

    // 3. Debounce protection: check if an action occurred in the last 4 seconds
    const { data: recentScan } = await supabaseServer
      .from('staff_attendance')
      .select('clock_in, clock_out, updated_at')
      .eq('staff_profile_id', staff.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentScan) {
      const lastActionTime = new Date(recentScan.clock_out || recentScan.clock_in).getTime();
      const diffSec = (now.getTime() - lastActionTime) / 1000;
      if (diffSec < 4) {
        return sendError(res, {
          status: 429,
          message: `Scan debounced: Please wait ${Math.ceil(4 - diffSec)}s before scanning again.`,
        });
      }
    }

    // 4. Check for an active open session (clock_out IS NULL)
    const { data: openSession } = await supabaseServer
      .from('staff_attendance')
      .select('*')
      .eq('staff_profile_id', staff.id)
      .is('clock_out', null)
      .maybeSingle();

    if (openSession) {
      // ── ACTION: CLOCK-OUT ──────────────────────────────────────────────────
      const clockInTime = new Date(openSession.clock_in);
      const durationMinutes = Math.max(1, Math.round((now.getTime() - clockInTime.getTime()) / (1000 * 60)));

      // If openSession was marked late, keep late. If duration < 240, mark half_day. Else present.
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
          clock_out_method: method,
          updated_at: now.toISOString(),
        })
        .eq('id', openSession.id)
        .select()
        .single();

      if (uErr) throw uErr;

      const durationHours = Math.floor(durationMinutes / 60);
      const remainingMins = durationMinutes % 60;
      const durationText = `${durationHours}h ${remainingMins}m`;

      return sendSuccess(res, {
        status: 200,
        message: `Goodbye, ${staff.user_profiles.full_name}! Clocked out at ${timeFormatted}. Shift duration: ${durationText}.`,
        data: {
          action: 'clock_out',
          staff: {
            id: staff.id,
            employee_id: staff.employee_id,
            full_name: staff.user_profiles.full_name,
            role: staff.user_profiles.role,
            department: staff.department,
          },
          attendance: updated,
          durationText,
          time: timeFormatted,
        },
      });
    } else {
      // ── ACTION: CLOCK-IN ───────────────────────────────────────────────────
      // Determine if arrival is late (shift_start_time default 09:00:00 + 15 min grace = 09:15)
      const shiftStart = staff.shift_start_time || '09:00:00';
      const [startH, startM] = shiftStart.split(':').map(Number);
      const graceMinutes = 15;
      const graceTime = new Date(now);
      graceTime.setHours(startH, startM + graceMinutes, 0, 0);

      const isLate = now.getTime() > graceTime.getTime();
      const initialStatus = isLate ? 'late' : 'working';

      const { data: created, error: cErr } = await supabaseServer
        .from('staff_attendance')
        .insert([
          {
            staff_profile_id: staff.id,
            attendance_date: todayStr,
            clock_in: now.toISOString(),
            status: initialStatus,
            clock_in_method: method,
            created_by: req.user?.email || 'system_scanner',
          },
        ])
        .select()
        .single();

      if (cErr) throw cErr;

      return sendSuccess(res, {
        status: 201,
        message: `Welcome, ${staff.user_profiles.full_name}! Clocked in at ${timeFormatted}${isLate ? ' (Late Arrival)' : ''}.`,
        data: {
          action: 'clock_in',
          staff: {
            id: staff.id,
            employee_id: staff.employee_id,
            full_name: staff.user_profiles.full_name,
            role: staff.user_profiles.role,
            department: staff.department,
          },
          attendance: created,
          isLate,
          time: timeFormatted,
        },
      });
    }
  } catch (err) {
    if (err.code === '23505') {
      return sendError(res, {
        status: 409,
        message: 'A clock-in session is already currently active for this staff member.',
      });
    }
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. MANUAL CLOCK-IN (ADMIN OVERRIDE)
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/clock-in', async (req, res) => {
  try {
    const { staffProfileId, date, time, notes } = req.body;
    if (!staffProfileId) return sendError(res, { status: 400, message: 'Staff profile ID is required' });

    // Check open session
    const { data: openSession } = await supabaseServer
      .from('staff_attendance')
      .select('id')
      .eq('staff_profile_id', staffProfileId)
      .is('clock_out', null)
      .maybeSingle();

    if (openSession) {
      return sendError(res, {
        status: 400,
        message: 'Staff member already has an active open session. Please clock out first.',
      });
    }

    const clockInTimestamp = time
      ? new Date(`${date || new Date().toISOString().slice(0, 10)}T${time}:00`).toISOString()
      : new Date().toISOString();

    const attendanceDate = date || clockInTimestamp.slice(0, 10);

    const { data, error } = await supabaseServer
      .from('staff_attendance')
      .insert([
        {
          staff_profile_id: staffProfileId,
          attendance_date: attendanceDate,
          clock_in: clockInTimestamp,
          status: 'working',
          clock_in_method: 'manual',
          notes: notes?.trim() || 'Manual clock-in by administrator',
          created_by: req.user?.email || 'admin',
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return sendSuccess(res, { status: 201, message: 'Clock-in recorded successfully', data });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. MANUAL CLOCK-OUT (ADMIN OVERRIDE)
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/clock-out', async (req, res) => {
  try {
    const { staffProfileId, time, notes } = req.body;
    if (!staffProfileId) return sendError(res, { status: 400, message: 'Staff profile ID is required' });

    const { data: openSession, error: oErr } = await supabaseServer
      .from('staff_attendance')
      .select('*')
      .eq('staff_profile_id', staffProfileId)
      .is('clock_out', null)
      .maybeSingle();

    if (oErr || !openSession) {
      return sendError(res, {
        status: 404,
        message: 'No open clock-in session found for this staff member.',
      });
    }

    const clockOutTimestamp = time
      ? new Date(`${openSession.attendance_date}T${time}:00`).toISOString()
      : new Date().toISOString();

    const durationMinutes = Math.max(
      1,
      Math.round((new Date(clockOutTimestamp).getTime() - new Date(openSession.clock_in).getTime()) / (1000 * 60))
    );

    const finalStatus = openSession.status === 'late' ? 'late' : durationMinutes >= 240 ? 'present' : 'half_day';

    const { data, error } = await supabaseServer
      .from('staff_attendance')
      .update({
        clock_out: clockOutTimestamp,
        duration_minutes: durationMinutes,
        status: finalStatus,
        clock_out_method: 'manual',
        notes: notes?.trim() || openSession.notes,
        updated_by: req.user?.email || 'admin',
        updated_at: new Date().toISOString(),
      })
      .eq('id', openSession.id)
      .select()
      .single();

    if (error) throw error;
    return sendSuccess(res, { status: 200, message: 'Clock-out recorded successfully', data });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. ATTENDANCE HISTORY FOR SINGLE STAFF
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/history/:staffProfileId', async (req, res) => {
  try {
    const { staffProfileId } = req.params;
    const { limit = 30 } = req.query;

    const { data, error } = await supabaseServer
      .from('staff_attendance')
      .select('*')
      .eq('staff_profile_id', staffProfileId)
      .order('attendance_date', { ascending: false })
      .order('clock_in', { ascending: false })
      .limit(parseInt(limit, 10));

    if (error) throw error;

    return sendSuccess(res, { status: 200, data: data || [] });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. CARD ASSIGNMENT & REVOCATION
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/cards/assign', restrictTo(ROLES.ADMIN), async (req, res) => {
  try {
    const { staffProfileId, cardUid, barcode, notes } = req.body;

    if (!staffProfileId || !barcode) {
      return sendError(res, { status: 400, message: 'Staff profile ID and barcode are required' });
    }

    // Check duplicate barcode
    const { data: existingBarcode } = await supabaseServer
      .from('staff_id_cards')
      .select('id')
      .eq('barcode', barcode.trim())
      .maybeSingle();

    if (existingBarcode) {
      return sendError(res, { status: 409, message: `Barcode "${barcode.trim()}" is already assigned to a card.` });
    }

    // Deactivate previous cards for this staff member
    await supabaseServer
      .from('staff_id_cards')
      .update({ is_active: false, deactivated_at: new Date().toISOString() })
      .eq('staff_profile_id', staffProfileId)
      .eq('is_active', true);

    const generatedUid = cardUid?.trim() || `CARD-${Date.now().toString().slice(-6)}`;

    const { data, error } = await supabaseServer
      .from('staff_id_cards')
      .insert([
        {
          staff_profile_id: staffProfileId,
          card_uid: generatedUid,
          barcode: barcode.trim(),
          is_active: true,
          notes: notes?.trim() || 'Assigned by administrator',
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return sendSuccess(res, { status: 201, message: 'Staff ID card assigned successfully', data });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

router.post('/cards/revoke', restrictTo(ROLES.ADMIN), async (req, res) => {
  try {
    const { cardId, reason = 'Deactivated by administrator' } = req.body;
    if (!cardId) return sendError(res, { status: 400, message: 'Card ID is required' });

    const { data, error } = await supabaseServer
      .from('staff_id_cards')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        notes: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cardId)
      .select()
      .single();

    if (error) throw error;
    return sendSuccess(res, { status: 200, message: 'ID card revoked successfully', data });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. ATTENDANCE RECORD CORRECTION (AUDITABLE)
// ═══════════════════════════════════════════════════════════════════════════════
router.patch('/:id', restrictTo(ROLES.ADMIN), async (req, res) => {
  try {
    const { id } = req.params;
    const { clock_in, clock_out, status, reason } = req.body;

    if (!reason || !reason.trim()) {
      return sendError(res, { status: 400, message: 'Audit reason is required for record correction' });
    }

    // 1. Fetch current record
    const { data: current, error: fErr } = await supabaseServer
      .from('staff_attendance')
      .select('*')
      .eq('id', id)
      .single();

    if (fErr || !current) {
      return sendError(res, { status: 404, message: 'Attendance record not found' });
    }

    const updates = {
      ...(clock_in !== undefined && { clock_in }),
      ...(clock_out !== undefined && { clock_out }),
      ...(status !== undefined && { status }),
      updated_by: req.user?.email || 'admin',
      updated_at: new Date().toISOString(),
    };

    if (clock_in && clock_out) {
      const dur = Math.max(1, Math.round((new Date(clock_out).getTime() - new Date(clock_in).getTime()) / (1000 * 60)));
      updates.duration_minutes = dur;
    }

    const { data: updated, error: uErr } = await supabaseServer
      .from('staff_attendance')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (uErr) throw uErr;

    // 2. Insert audit log
    await supabaseServer.from('attendance_audit_logs').insert([
      {
        attendance_id: id,
        action: 'UPDATE',
        previous_data: current,
        new_data: updated,
        reason,
        performed_by: req.user?.email || 'admin',
      },
    ]);

    return sendSuccess(res, {
      status: 200,
      message: 'Attendance record corrected and audited successfully',
      data: updated,
    });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

module.exports = router;
