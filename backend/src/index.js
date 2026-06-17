require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB, getDbStatus } = require('./db/connect');
const { runSeed } = require('./seed/runSeed');
const { isAllowedOrigin } = require('./config/cors');

const authRoutes = require('./routes/auth');
const terminologyRoutes = require('./routes/terminology');
const testRoutes = require('./routes/tests');
const assignmentRoutes = require('./routes/assignments');
const adminRoutes = require('./routes/admin');
const financeRoutes = require('./routes/finance');
const earningsRoutes = require('./routes/earnings');
const { EVENT_TYPES } = require('./config/events');

const app = express();
const PORT = process.env.PORT || 5000;
const isDev = process.env.NODE_ENV !== 'production';

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked origin: ${origin}`));
      }
    },
    credentials: true,
  })
);
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'football-labeling-api' });
});

app.get('/api/health', (_req, res) => {
  const db = getDbStatus();
  res.json({
    status: db.connected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    database: db,
  });
});

app.get('/api/events', (_req, res) => {
  res.json(EVENT_TYPES);
});

app.use('/api/auth', authRoutes);
app.use('/api/terminology', terminologyRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/finance', financeRoutes);
app.use('/api/earnings', earningsRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Internal server error' });
});

async function start() {
  if (process.env.NODE_ENV === 'production' && process.env.USE_MEMORY_DB === 'true') {
    throw new Error('USE_MEMORY_DB must be false in production. Use MongoDB Atlas.');
  }

  if (process.env.NODE_ENV === 'production' && !process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required in production.');
  }

  await connectDB();

  const seedResult = await runSeed();
  if (!seedResult.skipped) {
    console.log('Auto-seeded database on first run');
    console.log('Admin login: admin@labeling.local / admin123');
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    if (isDev) {
      console.log('Local API: http://localhost:' + PORT);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the other process or set PORT in .env`);
      process.exit(1);
    }
    throw err;
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  if (process.env.USE_MEMORY_DB !== 'true') {
    console.error('\nTip: Set USE_MEMORY_DB=true in backend/.env for local dev without MongoDB');
  }
  process.exit(1);
});
