const User = require('../models/User');
const VideoAssignment = require('../models/VideoAssignment');
const { terminologies, testQuestions, sampleAssignments } = require('./data');
const { syncTerminology, syncTestQuestions } = require('./syncContent');

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

  return {
    skipped: false,
    terminology: terminologies.length,
    questions: testQuestions.length,
    assignments: await VideoAssignment.countDocuments(),
    adminEmail,
  };
}

module.exports = { runSeed };
