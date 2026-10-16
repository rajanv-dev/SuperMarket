const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../src/app');
const User = require('../src/models/User');

// Use a separate test database
const TEST_DB = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/super_test';

beforeAll(async () => {
  await mongoose.connect(TEST_DB);
});

afterEach(async () => {
  // Clean up after each test
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
});

// ── Health check ──────────────────────────────────────────────────────────────
describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('ok');
  });
});

// ── Registration ──────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('registers a new customer and returns a JWT', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test Customer',
      email: 'test@example.com',
      password: 'Password1',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('test@example.com');
    expect(res.body.data.user.role).toBe('customer');
    expect(res.body.data.token).toBeDefined();
    // Password hash must never appear in the response
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Test Customer',
      email: 'dup@example.com',
      password: 'Password1',
    });
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test Customer 2',
      email: 'dup@example.com',
      password: 'Password1',
    });
    expect(res.status).toBe(409);
  });

  it('rejects weak passwords with 422', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Weak',
      email: 'weak@example.com',
      password: '1234',
    });
    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  it('rejects missing fields with 422', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'nopw@x.com' });
    expect(res.status).toBe(422);
  });
});

// ── Login ──────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Login Test',
      email: 'login@example.com',
      password: 'Password1',
    });
  });

  it('logs in with valid credentials and returns JWT', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@example.com',
      password: 'Password1',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects wrong password with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@example.com',
      password: 'WrongPassword1',
    });
    expect(res.status).toBe(401);
  });

  it('rejects non-existent email with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'ghost@example.com',
      password: 'Password1',
    });
    expect(res.status).toBe(401);
    // Both invalid user and invalid password must return identical message
    // to prevent user enumeration
    expect(res.body.message).toBe('Invalid email or password');
  });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  it('returns user profile with valid token', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Me Test',
      email: 'me@example.com',
      password: 'Password1',
    });
    const { token } = reg.body.data;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('me@example.com');
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
      email: 'cust@example.com',
      password: 'Password1',
    });
    const { token } = reg.body.data;

    // /api/analytics/overview will be registered in a later phase — test 404 for now
    // When admin routes are added, this token should yield 403
    const res = await request(app)
      .get('/api/analytics/overview')
      .set('Authorization', `Bearer ${token}`);
    // 404 because route not yet mounted — acceptable in Phase 1
    expect([403, 404]).toContain(res.status);
  });
});
