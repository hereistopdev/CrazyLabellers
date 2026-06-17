const User = require('../models/User');
const Terminology = require('../models/Terminology');
const TestQuestion = require('../models/TestQuestion');
const VideoAssignment = require('../models/VideoAssignment');
const { terminologies, testQuestions, sampleAssignments } = require('./data');

async function runSeed({ force = false } = {}) {
  const termCount = await Terminology.countDocuments();
  if (termCount > 0 && !force) {
    return { skipped: true };
  }

  if (force) {
    await Promise.all([
      Terminology.deleteMany({}),
      TestQuestion.deleteMany({}),
      VideoAssignment.deleteMany({}),
    ]);
  }

  await Terminology.insertMany(terminologies);
  await TestQuestion.insertMany(testQuestions);
  await VideoAssignment.insertMany(sampleAssignments);

  const adminEmail = 'admin@labeling.local';
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({
      name: 'Admin',
      email: adminEmail,
      password: 'admin123',
      role: 'admin',
      status: 'approved',
    });
  }

  return {
    skipped: false,
    terminology: terminologies.length,
    questions: testQuestions.length,
    assignments: sampleAssignments.length,
    adminEmail,
  };
}

module.exports = { runSeed };
