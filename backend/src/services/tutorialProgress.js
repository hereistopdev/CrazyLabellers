const VideoAssignment = require('../models/VideoAssignment');
const LabelSubmission = require('../models/LabelSubmission');
const User = require('../models/User');

async function getTutorialProgress(userId) {
  const tutorials = await VideoAssignment.find({ kind: 'tutorial' })
    .sort({ sortOrder: 1, createdAt: 1 })
    .select('_id title sortOrder');

  if (tutorials.length === 0) {
    return { total: 0, completed: 0, allCompleted: true, tutorials: [] };
  }

  const submissions = await LabelSubmission.find({
    userId,
    assignmentId: { $in: tutorials.map((t) => t._id) },
    status: { $in: ['submitted', 'approved'] },
  }).select('assignmentId updatedAt');

  const completedSet = new Set(submissions.map((s) => String(s.assignmentId)));

  return {
    total: tutorials.length,
    completed: completedSet.size,
    allCompleted: completedSet.size >= tutorials.length,
    tutorials: tutorials.map((t) => ({
      id: t._id,
      title: t.title,
      completed: completedSet.has(String(t._id)),
      completedAt: submissions.find((s) => String(s.assignmentId) === String(t._id))?.updatedAt,
    })),
  };
}

async function refreshTutorialCompletion(userId) {
  const progress = await getTutorialProgress(userId);
  const user = await User.findByIdAndUpdate(
    userId,
    { tutorialsCompleted: progress.allCompleted },
    { new: true }
  );
  return { user, progress };
}

/** Tutorials are study material — always open, never assigned to one labeller. */
async function ensureTutorialAssignmentsOpen() {
  await VideoAssignment.updateMany(
    { kind: 'tutorial' },
    { $set: { status: 'available', assignedTo: null, taskPrice: 0 } }
  );
}

function canAccessTutorial(user) {
  if (user.status === 'approved' || user.status === 'passed_test') {
    return true;
  }
  return (user.bestTestScore ?? 0) >= 80;
}

function canAccessPretest(user) {
  if (user.status === 'approved') return true;
  return user.status === 'passed_test' && Boolean(user.tutorialsCompleted);
}

function canAccessProduction(user) {
  const { PASS_THRESHOLD } = require('../utils/labelingScore');
  if (user.status === 'approved') return true;
  return (
    user.status === 'passed_test' &&
    Boolean(user.tutorialsCompleted) &&
    (user.labelingTestPassed || user.bestLabelingTestScore >= PASS_THRESHOLD)
  );
}

module.exports = {
  getTutorialProgress,
  refreshTutorialCompletion,
  ensureTutorialAssignmentsOpen,
  canAccessTutorial,
  canAccessPretest,
  canAccessProduction,
};
