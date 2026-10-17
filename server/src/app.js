require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server: SocketServer } = require('socket.io');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// ── Route imports ─────────────────────────────────────────────────────────────
const authRoutes = require('./modules/auth/auth.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const productRoutes = require('./modules/products/products.routes');
const attendanceRoutes = require('./modules/attendance/attendance.routes');
const cartRoutes = require('./modules/cart/cart.routes');
const orderRoutes = require('./modules/orders/orders.routes');

// ── App setup ─────────────────────────────────────────────────────────────────
const app = express();
const httpServer = createServer(app);

const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null,
  'http://localhost:5173',
  'http://localhost:5175',
].filter(Boolean);

// ── Socket.IO (Phase 6) ───────────────────────────────────────────────────────
const io = new SocketServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Make io accessible to controllers via req.app.get('io')
app.set('io', io);

// ── Database ──────────────────────────────────────────────────────────────────
connectDB();

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (same-origin rewrites, curl, mobile) or matching allowed origins
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Global rate limiter (bypassed in test environment)
const globalLimiter =
  process.env.NODE_ENV === 'test'
    ? (_req, _res, next) => next()
    : rateLimit({
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
        max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
        message: { success: false, message: 'Too many requests, please slow down' },
        standardHeaders: true,
        legacyHeaders: false,
      });
app.use('/api/', globalLimiter);

// ── Request middleware ────────────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10kb' })); // prevent large payload attacks
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Health checks ─────────────────────────────────────────────────────────────
// 1. API service health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'VRK Supermarket API',
    timestamp: new Date().toISOString(),
  });
});

// 2. Database connectivity health check (Supabase)
app.get('/api/health/db', async (req, res) => {
  try {
    const { supabaseServer, isSupabaseConfigured } = require('./config/supabase');
    if (!isSupabaseConfigured || !supabaseServer) {
      return res.status(503).json({
        status: 'error',
        service: 'VRK Supermarket Database',
        connected: false,
        message: 'Database service not configured',
        timestamp: new Date().toISOString(),
      });
    }

    const { data, error } = await supabaseServer.from('products').select('id').limit(1);
    if (error) {
      return res.status(503).json({
        status: 'error',
        service: 'VRK Supermarket Database',
        connected: false,
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      status: 'ok',
      service: 'VRK Supermarket Database',
      connected: true,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(503).json({
      status: 'error',
      service: 'VRK Supermarket Database',
      connected: false,
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/attendance', attendanceRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
// app.use('/api/payments',    paymentRoutes);
// app.use('/api/inventory',   inventoryRoutes);
// app.use('/api/pos',         posRoutes);
// app.use('/api/analytics',   analyticsRoutes);
// app.use('/api/suppliers',   supplierRoutes);
// app.use('/api/coupons',     couponRoutes);
// app.use('/api/audit',       auditRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

// ── Socket.IO auth placeholder (Phase 6 will expand this) ────────────────────
io.use((socket, next) => {
  // TODO Phase 6: verify JWT from socket.handshake.auth.token
  next();
});

io.on('connection', (socket) => {
  logger.debug(`Socket connected: ${socket.id}`);
  socket.on('disconnect', () => logger.debug(`Socket disconnected: ${socket.id}`));
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '5000', 10);

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  httpServer.listen(PORT, () => {
    logger.info(`VRK Supermarket API running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  // Force exit after 10 s if connections linger
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled rejection: ${err.message}`);
  shutdown('unhandledRejection');
});

// Attach helpers to app for backward-compatible destructuring and tests
app.app = app;
app.httpServer = httpServer;
app.io = io;

module.exports = app;
