require('dotenv').config();
const { connectDB, disconnectDB } = require('../db/connect');
const { syncTerminology, syncTestQuestions } = require('../seed/syncContent');

async function main() {
  await connectDB();
  const terms = await syncTerminology();
  const questions = await syncTestQuestions();
  console.log(`Synced ${terms} terminology entries and ${questions} test questions`);
  await disconnectDB();
}

main().catch(async (err) => {
  console.error('Sync failed:', err.message);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
