require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB, getDbStatus } = require('./db/connect');
const { runSeed } = require('./seed/runSeed');
const { isAllowedOrigin, describeCorsConfig } = require('./config/cors');

const authRoutes = require('./routes/auth');
const terminologyRoutes = require('./routes/terminology');
const testRoutes = require('./routes/tests');
const assignmentRoutes = require('./routes/assignments');
const adminRoutes = require('./routes/admin');
const financeRoutes = require('./routes/finance');
const earningsRoutes = require('./routes/earnings');
const videoRoutes = require('./routes/videos');
const reviewRoutes = require('./routes/review');
const labelingTestRoutes = require('./routes/labelingTest');
const labellerRoutes = require('./routes/labellers');
const tutorialRoutes = require('./routes/tutorials');
const taskAdminRoutes = require('./routes/taskAdmin');
const helpRoutes = require('./routes/help');
const imageRoutes = require('./routes/images');
const imageAssignmentRoutes = require('./routes/imageAssignments');
const imageAdminRoutes = require('./routes/imageAdmin');
const { EVENT_TYPES } = require('./config/events');

const app = express();
const PORT = process.env.PORT || 5000;
const isDev = process.env.NODE_ENV !== 'production';

// Prevent 304 responses with empty bodies on repeat JSON API calls (breaks fetch + no-store).
app.set('etag', false);

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, origin || true);
      } else {
        console.warn(`CORS blocked origin: ${origin || '(none)'}`);
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Disposition'],
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
app.use('/api/videos', videoRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/labeling-test', labelingTestRoutes);
app.use('/api/labellers', labellerRoutes);
app.use('/api/tutorials', tutorialRoutes);
app.use('/api/admin/tasks', taskAdminRoutes);
app.use('/api/help', helpRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/image-assignments', imageAssignmentRoutes);
app.use('/api/admin/images', imageAdminRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'Video file too large (max 100MB)' });
  }
  res.status(500).json({ message: err.message || 'Internal server error' });
});

async function start() {
  if (process.env.USE_MEMORY_DB === 'true') {
    console.warn('WARNING: USE_MEMORY_DB=true — data is ephemeral and not shared with production.');
  }

  if (process.env.NODE_ENV === 'production' && process.env.USE_MEMORY_DB === 'true') {
    throw new Error('USE_MEMORY_DB must be false in production. Use MongoDB Atlas.');
  }

  if (!process.env.MONGODB_URI?.trim() && process.env.USE_MEMORY_DB !== 'true') {
    throw new Error('MONGODB_URI is required. Add your MongoDB Atlas URI to backend/.env');
  }

  await connectDB();

  const seedResult = await runSeed();
  if (seedResult.terminology) {
    console.log(`Synced ${seedResult.terminology} terminology definitions`);
  }
  if (seedResult.questions) {
    console.log(`Synced ${seedResult.questions} knowledge test questions`);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    if (isDev) {
      console.log('Local API: http://localhost:' + PORT);
    } else {
      const cors = describeCorsConfig();
      console.log(
        `CORS allowed origins: ${cors.origins.length ? cors.origins.join(', ') : '(none configured — set CLIENT_URL)'}`
      );
      if (cors.domains.length) {
        console.log(`CORS allowed domains: ${cors.domains.join(', ')}`);
      }
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
  process.exit(1);
});
