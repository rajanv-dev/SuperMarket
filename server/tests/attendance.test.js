const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../src/app');
const { ROLES } = require('../src/config/constants');
const { supabaseServer } = require('../src/config/supabase');

const JWT_SECRET = process.env.JWT_SECRET || '9983168fbd9c07dfa08963727d0eac786ae278266c528cd36482f60699a2d0e33b5de671078f0a37b34595f9007a2fed634245cea8c6b2070370aa6b166e909e';

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

describe('Staff Attendance API Security & Validation', () => {
  // ── Authentication & Role Authorization ────────────────────────────────────
  describe('Authorization checks on /api/admin/attendance endpoints', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/admin/attendance/summary');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects customer accounts with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/attendance/summary')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('permits authorized admin accounts with 200 OK', async () => {
      const res = await request(app)
        .get('/api/admin/attendance/summary')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalStaff');
      expect(res.body.data).toHaveProperty('presentCount');
      expect(res.body.data).toHaveProperty('currentlyWorkingCount');
      expect(res.body.data).toHaveProperty('lateCount');
      expect(res.body.data).toHaveProperty('absentCount');
    });
  });

  // ── Card Scanner & Validation ──────────────────────────────────────────────
  describe('POST /api/admin/attendance/scan', () => {
    it('rejects empty or missing cardCode with 400', async () => {
      const res = await request(app)
        .post('/api/admin/attendance/scan')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/barcode or card ID is required/i);
    });

    it('rejects unknown or invalid card codes with 404', async () => {
      const res = await request(app)
        .post('/api/admin/attendance/scan')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cardCode: 'INVALID-NONEXISTENT-CODE-9999' });
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/No staff account found/i);
    });

    it('prevents customer from triggering card scans with 403', async () => {
      const res = await request(app)
        .post('/api/admin/attendance/scan')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ cardCode: 'EMP-1001' });
      expect(res.status).toBe(403);
    });
  });

  // ── Manual Attendance Clock-In & Clock-Out Validation ──────────────────────
  describe('Manual Clock-In / Clock-Out Validation', () => {
    it('validates required fields for manual clock-in', async () => {
      const res = await request(app)
        .post('/api/admin/attendance/clock-in')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects clock-out when no open session exists with 404', async () => {
      // Pass a non-existent UUID
      const fakeUuid = '00000000-0000-0000-0000-000000000099';
      const res = await request(app)
        .post('/api/admin/attendance/clock-out')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ staffProfileId: fakeUuid });
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/No open clock-in session/i);
    });
  });

  // ── Attendance Records Filtering ───────────────────────────────────────────
  describe('GET /api/admin/attendance', () => {
    it('returns attendance record list with metadata and pagination', async () => {
      const res = await request(app)
        .get('/api/admin/attendance')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ limit: 10, page: 1 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
    });

    it('allows filtering by date parameter', async () => {
      const res = await request(app)
        .get('/api/admin/attendance')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ date: '2026-10-16' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ── Audit Trail for Admin Corrections ──────────────────────────────────────
  describe('PATCH /api/admin/attendance/:id (Audit-Logged Correction)', () => {
    it('requires a reason for correction', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000001';
      const res = await request(app)
        .patch(`/api/admin/attendance/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'present' }); // missing reason
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/reason is required/i);
    });
  });
});
