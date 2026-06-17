const mongoose = require('mongoose');

let memoryServer = null;

async function connectDB() {
  let uri = process.env.MONGODB_URI;

  if (process.env.USE_MEMORY_DB === 'true') {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri('football-labeling');
    console.log('Using in-memory MongoDB (USE_MEMORY_DB=true)');
  } else if (!uri) {
    uri = 'mongodb://127.0.0.1:27017/football-labeling';
  }

  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
}

module.exports = { connectDB, disconnectDB };
