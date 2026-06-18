const User = require('../models/User');
const VideoAssignment = require('../models/VideoAssignment');
const { terminologies, testQuestions, sampleAssignments } = require('./data');
const { syncTerminology, syncTestQuestions } = require('./syncContent');
const { setupPretestClips } = require('../services/pretestSetup');

async function runSeed({ force = false } = {}) {
  if (force) {
    await VideoAssignment.deleteMany({});
  }

  await syncTerminology();
  await syncTestQuestions();

  const assignmentCount = await VideoAssignment.countDocuments();
  if (force || assignmentCount === 0) {
    if (assignmentCount === 0) {
      await VideoAssignment.insertMany(sampleAssignments);
    } else if (force) {
      await VideoAssignment.insertMany(sampleAssignments);
    }
  }

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

  const checkerEmail = 'checker@labeling.local';
  let checker = await User.findOne({ email: checkerEmail });
  if (!checker) {
    checker = await User.create({
      name: 'Checker',
      email: checkerEmail,
      password: 'checker123',
      role: 'checker',
      status: 'approved',
    });
  }

  let pretestSetup = null;
  try {
    pretestSetup = await setupPretestClips({ pretestCount: 3 });
  } catch (error) {
    console.warn('Pretest clip setup skipped:', error.message);
  }

  return {
    skipped: false,
    terminology: terminologies.length,
    questions: testQuestions.length,
    assignments: await VideoAssignment.countDocuments(),
    adminEmail,
    checkerEmail,
    pretestSetup,
  };
}

module.exports = { runSeed };
