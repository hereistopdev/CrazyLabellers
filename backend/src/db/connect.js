const mongoose = require('mongoose');

let memoryServer = null;
let dbMode = 'unknown';

async function connectDB() {
  if (process.env.USE_MEMORY_DB === 'true') {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    const uri = memoryServer.getUri('football-labeling');
    dbMode = 'memory';
    console.log('Using in-memory MongoDB (USE_MEMORY_DB=true — dev/tests only)');
    await mongoose.connect(uri);
    console.log(`MongoDB connected (${dbMode})`);
    return;
  }

  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error(
      'MONGODB_URI is required in backend/.env. Use your MongoDB Atlas connection string for local and production.'
    );
  }

  if (uri.includes('mongodb.net') || uri.includes('mongodb+srv')) {
    dbMode = 'atlas';
  } else {
    dbMode = 'mongodb';
  }

  try {
    await mongoose.connect(uri);
    console.log(`MongoDB connected (${dbMode})`);
  } catch (err) {
    if (err.message?.includes('bad auth') || err.code === 8000) {
      throw new Error(
        'MongoDB authentication failed. Check MONGODB_URI username/password. ' +
          'URL-encode special characters in the password (@ → %40, # → %23, etc.).'
      );
    }
    if (err.message?.includes('querySrv ECONNREFUSED') || err.code === 'ECONNREFUSED') {
      throw new Error(
        'Cannot reach MongoDB. Verify MONGODB_URI, Atlas Network Access (allow your IP), and cluster status.'
      );
    }
    throw err;
  }
}

function getDbStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const readyState = mongoose.connection.readyState;

  return {
    connected: readyState === 1,
    state: states[readyState] || 'unknown',
    mode: dbMode,
    database: mongoose.connection.name || null,
    host: mongoose.connection.host || null,
  };
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
}

module.exports = { connectDB, disconnectDB, getDbStatus };
