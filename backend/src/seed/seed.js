require('dotenv').config();
const { connectDB, disconnectDB } = require('../db/connect');
const { runSeed } = require('./runSeed');

async function seed() {
  await connectDB();

  const result = await runSeed({ force: true });
  if (result.skipped) {
    console.log('Seed skipped');
  } else {
    console.log(`Synced ${result.terminology} terminology entries`);
    console.log(`Synced ${result.questions} test questions`);
    console.log(`${result.assignments} video assignment(s) in database`);
    console.log(`Admin user: ${result.adminEmail} / admin123`);
  }

  console.log('Seed completed successfully');
  await disconnectDB();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
