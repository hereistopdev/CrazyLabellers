const User = require('../models/User');
const VideoAssignment = require('../models/VideoAssignment');
const { terminologies, testQuestions, sampleAssignments } = require('./data');
const { syncTerminology, syncTestQuestions } = require('./syncContent');
const { setupPretestClips } = require('../services/pretestSetup');
const { ensureTutorialAssignmentsOpen } = require('../services/tutorialProgress');

async function runSeed({ force = false } = {}) {
  if (force) {
    await VideoAssignment.deleteMany({});
  }

  await syncTerminology();
  await syncTestQuestions();

  const isProduction = process.env.NODE_ENV === 'production';
  const assignmentCount = await VideoAssignment.countDocuments();
  if (!isProduction && (force || assignmentCount === 0)) {
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

  const validatorEmail = 'validator@labeling.local';
  let validator = await User.findOne({ email: validatorEmail });
  if (!validator) {
    validator = await User.create({
      name: 'Validator',
      email: validatorEmail,
      password: 'validator123',
      role: 'validator',
      status: 'approved',
    });
  }

  const checkerEmail = 'checker@labeling.local';
  let checker = await User.findOne({ email: checkerEmail });
  if (!checker) {
    checker = await User.create({
      name: 'Checker (legacy)',
      email: checkerEmail,
      password: 'checker123',
      role: 'checker',
      status: 'approved',
    });
  }

  let pretestSetup = null;
  if (process.env.AUTO_SETUP_PRETEST === 'true') {
    try {
      pretestSetup = await setupPretestClips({ pretestCount: 3 });
    } catch (error) {
      console.warn('Pretest clip setup skipped:', error.message);
    }
  }

  try {
    await ensureTutorialAssignmentsOpen();
  } catch (error) {
    console.warn('Tutorial reset skipped:', error.message);
  }

  return {
    skipped: false,
    terminology: terminologies.length,
    questions: testQuestions.length,
    assignments: await VideoAssignment.countDocuments(),
    adminEmail,
    validatorEmail,
    checkerEmail,
    pretestSetup,
  };
}

module.exports = { runSeed };
