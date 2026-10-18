const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../src/app');
const { ROLES } = require('../src/config/constants');
const { supabaseServer } = require('../src/config/supabase');

const JWT_SECRET =
  process.env.JWT_SECRET ||
  '9983168fbd9c07dfa08963727d0eac786ae278266c528cd36482f60699a2d0e33b5de671078f0a37b34595f9007a2fed634245cea8c6b2070370aa6b166e909e';

const adminToken = jwt.sign(
  { id: 'admin-test-id', email: 'admin@super.local', role: ROLES.ADMIN, name: 'Admin User' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const customerToken = jwt.sign(
  { id: 'customer-test-id', email: 'customer@super.local', role: ROLES.CUSTOMER, name: 'Customer User' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const cashierToken = jwt.sign(
  { id: 'cashier-test-id', email: 'cashier@super.local', role: ROLES.CASHIER, name: 'Cashier User' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

describe('VRK Supermarket — Staff Management & QR Attendance System', () => {
  let createdStaffId = null;
  let createdStaffCode = null;
  let qrPayload = null;

  afterAll(async () => {
    // Clean up test staff and attendance records created during testing
    if (createdStaffId && supabaseServer) {
      await supabaseServer.from('attendance').delete().eq('staff_id', createdStaffId);
      await supabaseServer.from('staff').delete().eq('id', createdStaffId);
    }
  });

  // ── 1. STAFF CREATION & AUTOMATIC QR GENERATION ────────────────────────────
  describe('POST /api/staff', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).post('/api/staff').send({ full_name: 'Test Staff' });
      expect(res.status).toBe(401);
    });

    it('rejects customer role with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ full_name: 'Unauthorized Staff', role: 'Cashier' });
      expect(res.status).toBe(403);
    });

    it('validates required fields: full_name and role', async () => {
      const res = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ phone: '9876543210' }); // missing full_name & role
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('creates staff member and generates sequential staff_code & QR code', async () => {
      const uniqueSuffix = Date.now().toString().slice(-4);
      const res = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          full_name: `Arun Kumar ${uniqueSuffix}`,
          phone: `98765${uniqueSuffix}`,
          email: `arun.${uniqueSuffix}@super.local`,
          role: 'Store Associate',
          department: 'Grocery Operations',
          date_of_joining: '2026-01-15',
          is_active: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('staff_code');
      expect(res.body.data.staff_code).toMatch(/^VRK-STF-\d{4}$/);
      expect(res.body.data).toHaveProperty('qr_payload');
      expect(res.body.data.qr_payload).toMatch(/^VRK:STF:[a-f0-9]{64}$/);
      expect(res.body.data).toHaveProperty('qr_data_url');
      expect(res.body.data.qr_data_url).toMatch(/^data:image\/png;base64,/);

      // Save for subsequent tests
      createdStaffId = res.body.data.id;
      createdStaffCode = res.body.data.staff_code;
      qrPayload = res.body.data.qr_payload;
    });
  });

  // ── 2. STAFF LIST & SEARCH ─────────────────────────────────────────────────
  describe('GET /api/staff', () => {
    it('returns staff list with pagination metadata', async () => {
      const res = await request(app)
        .get('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
    });

    it('searches staff by name or staff code', async () => {
      const res = await request(app)
        .get('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ search: createdStaffCode });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].staff_code).toBe(createdStaffCode);
    });
  });

  // ── 3. SINGLE STAFF & ATTENDANCE HISTORY ───────────────────────────────────
  describe('GET /api/staff/:id', () => {
    it('fetches staff details and attendance history by UUID', async () => {
      const res = await request(app)
        .get(`/api/staff/${createdStaffId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.staff.id).toBe(createdStaffId);
      expect(Array.isArray(res.body.data.attendance_history)).toBe(true);
    });

    it('fetches staff details by human-readable staff code', async () => {
      const res = await request(app)
        .get(`/api/staff/${createdStaffCode}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.staff.staff_code).toBe(createdStaffCode);
    });
  });

  // ── 4. STAFF QR CODE RETRIEVAL ─────────────────────────────────────────────
  describe('GET /api/staff/:id/qr', () => {
    it('returns QR code data URL and payload for ID card printing', async () => {
      const res = await request(app)
        .get(`/api/staff/${createdStaffId}/qr`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.qr_data_url).toMatch(/^data:image\/png;base64,/);
      expect(res.body.data.staff_code).toBe(createdStaffCode);
    });
  });

  // ── 5. ATTENDANCE SCANNING & DUPLICATE PREVENTION ──────────────────────────
  describe('POST /api/attendance/scan', () => {
    it('rejects unauthorized users (e.g. customers) from scanning QR', async () => {
      const res = await request(app)
        .post('/api/attendance/scan')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ qr_token: qrPayload });
      expect(res.status).toBe(403);
    });

    it('rejects invalid or forged QR token with 404 Not Found', async () => {
      const res = await request(app)
        .post('/api/attendance/scan')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ qr_token: 'VRK:STF:0000000000000000000000000000000000000000000000000000000000000000' });
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('marks attendance successfully for authorized scanner and valid staff QR', async () => {
      const res = await request(app)
        .post('/api/attendance/scan')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ qr_token: qrPayload });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/Attendance marked successfully/i);
      expect(res.body.data.staff_code).toBe(createdStaffCode);
      expect(res.body.data.status).toBe('Present');
      expect(res.body.data).toHaveProperty('time');
    });

    it('prevents duplicate attendance on the same date with duplicate notification', async () => {
      // Second scan on the same day
      const res = await request(app)
        .post('/api/attendance/scan')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ qr_token: qrPayload });

      expect(res.status).toBe(200);
      expect(res.body.already_marked).toBe(true);
      expect(res.body.message).toMatch(/already recorded/i);
      expect(res.body.data.staff_code).toBe(createdStaffCode);
    });

    it('allows manual staff ID entry fallback for authorized users', async () => {
      // Manual entry with created staff code
      const res = await request(app)
        .post('/api/attendance/scan')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          manual: true,
          staff_code: createdStaffCode,
        });

      // Should indicate attendance already marked today
      expect(res.status).toBe(200);
      expect(res.body.already_marked).toBe(true);
      expect(res.body.data.staff_code).toBe(createdStaffCode);
    });

    it('rejects attendance if staff is inactive', async () => {
      // 1. Deactivate the staff member
      await request(app)
        .patch(`/api/staff/${createdStaffId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: false });

      // 2. Try to scan QR
      const res = await request(app)
        .post('/api/attendance/scan')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ qr_token: qrPayload });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/inactive/i);

      // Reactivate
      await request(app)
        .patch(`/api/staff/${createdStaffId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: true });
    });
  });

  // ── 6. ATTENDANCE DASHBOARD SUMMARY & CSV EXPORT ───────────────────────────
  describe('GET /api/attendance & GET /api/attendance/export', () => {
    it('returns attendance dashboard summary statistics', async () => {
      const res = await request(app)
        .get('/api/attendance')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary).toHaveProperty('total_active_staff');
      expect(res.body.summary).toHaveProperty('present_today');
      expect(res.body.summary).toHaveProperty('not_marked_present');
      expect(res.body.summary).toHaveProperty('attendance_percentage');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('exports attendance records as CSV format with proper headers', async () => {
      const res = await request(app)
        .get('/api/attendance/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toContain('Staff ID,Staff Name,Role,Department,Phone');
    });
  });
});
