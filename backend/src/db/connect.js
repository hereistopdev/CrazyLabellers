const mongoose = require('mongoose');

let memoryServer = null;
let dbMode = 'unknown';

async function connectDB() {
  let uri = process.env.MONGODB_URI;

  if (process.env.USE_MEMORY_DB === 'true') {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri('football-labeling');
    dbMode = 'memory';
    console.log('Using in-memory MongoDB (USE_MEMORY_DB=true)');
  } else if (uri?.includes('mongodb+srv')) {
    dbMode = 'atlas';
  } else if (uri) {
    dbMode = 'local';
  } else {
    uri = 'mongodb://127.0.0.1:27017/football-labeling';
    dbMode = 'local';
  }

  try {
    await mongoose.connect(uri);
    console.log(`MongoDB connected (${dbMode})`);
  } catch (err) {
    if (err.message?.includes('bad auth') || err.code === 8000) {
      throw new Error(
        'MongoDB authentication failed. Check MONGODB_URI username/password on Render. ' +
          'URL-encode special characters in the password (@ → %40, # → %23, etc.).'
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
