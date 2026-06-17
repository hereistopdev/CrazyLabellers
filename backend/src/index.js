require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db/connect');
const { runSeed } = require('./seed/runSeed');

const authRoutes = require('./routes/auth');
const terminologyRoutes = require('./routes/terminology');
const testRoutes = require('./routes/tests');
const assignmentRoutes = require('./routes/assignments');
const adminRoutes = require('./routes/admin');
const { EVENT_TYPES } = require('./config/events');

const app = express();
const PORT = process.env.PORT || 5000;
const isDev = process.env.NODE_ENV !== 'production';

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ||
        origin === process.env.CLIENT_URL
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/events', (_req, res) => {
  res.json(EVENT_TYPES);
});

app.use('/api/auth', authRoutes);
app.use('/api/terminology', terminologyRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Internal server error' });
});

async function start() {
  await connectDB();

  const seedResult = await runSeed();
  if (!seedResult.skipped) {
    console.log('Auto-seeded database on first run');
    console.log('Admin login: admin@labeling.local / admin123');
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (isDev) {
      console.log(`Frontend should proxy API calls from http://localhost:5173`);
    }
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  if (process.env.USE_MEMORY_DB !== 'true') {
    console.error('\nTip: Set USE_MEMORY_DB=true in backend/.env to run without installing MongoDB');
  }
  process.exit(1);
});
