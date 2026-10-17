const request = require('supertest');
const { app } = require('../src/app');
const User = require('../src/models/User');

// Generate unique test emails to avoid collisions across test runs
const testId = Date.now();
const testEmail = `test_${testId}@example.com`;
const dupEmail = `dup_${testId}@example.com`;
const loginEmail = `login_${testId}@example.com`;
const meEmail = `me_${testId}@example.com`;
const custEmail = `cust_${testId}@example.com`;

afterAll(async () => {
  // Clean up any test users created during this run
  try {
    await User.deleteMany({ email: testEmail });
    await User.deleteMany({ email: dupEmail });
    await User.deleteMany({ email: loginEmail });
    await User.deleteMany({ email: meEmail });
    await User.deleteMany({ email: custEmail });
  } catch {}
});

// ── Health checks ─────────────────────────────────────────────────────────────
describe('GET /api/health and /api/health/db', () => {
  it('returns 200 with status ok for API health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('VRK Supermarket API');
  });

  it('returns 200 with status ok for database health', async () => {
    const res = await request(app).get('/api/health/db');
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
  });
});

// ── Registration ──────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('registers a new customer and returns a JWT', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test Customer',
      email: testEmail,
      password: 'Password1',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.user.role).toBe('customer');
    expect(res.body.data.token).toBeDefined();
    // Password hash must never appear in the response
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user._passwordHash).toBeUndefined();
  });

  it('rejects duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Test Customer',
      email: dupEmail,
      password: 'Password1',
    });
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test Customer 2',
      email: dupEmail,
      password: 'Password1',
    });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('rejects weak passwords with 422', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Weak',
      email: `weak_${testId}@example.com`,
      password: '1234',
    });
    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  it('rejects missing fields with 422', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `nopw_${testId}@x.com` });
    expect(res.status).toBe(422);
  });
});

// ── Login ──────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Login Test',
      email: loginEmail,
      password: 'Password1',
    });
  });

  it('logs in with valid credentials and returns JWT', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: loginEmail,
      password: 'Password1',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects wrong password with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: loginEmail,
      password: 'WrongPassword1',
    });
    expect(res.status).toBe(401);
  });

  it('rejects non-existent email with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: `ghost_${testId}@example.com`,
      password: 'Password1',
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  it('returns user profile with valid token', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Me Test',
      email: meEmail,
      password: 'Password1',
    });
    const { token } = reg.body.data;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(meEmail);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a tampered token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer tampered.jwt.token');
    expect(res.status).toBe(401);
  });
});

// ── Unauthorized access to admin endpoints ────────────────────────────────────
describe('Role-based access control', () => {
  it('prevents a customer from accessing admin-only endpoints', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Customer',
      email: custEmail,
      password: 'Password1',
    });
    const { token } = reg.body.data;

    const res = await request(app)
      .get('/api/admin/metrics')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
