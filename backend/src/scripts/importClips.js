require('dotenv').config();
const { connectDB, disconnectDB } = require('../db/connect');
const { importClipsFromDir } = require('../services/clipImport');

async function main() {
  await connectDB();
  const result = await importClipsFromDir();
  console.log(`Import complete from ${result.dataDir}`);
  console.log(`Created: ${result.created}, skipped: ${result.skipped}, total files: ${result.total}`);
  await disconnectDB();
}

main().catch(async (err) => {
  console.error('Import failed:', err.message);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
