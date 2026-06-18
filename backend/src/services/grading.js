const LabelingTestResult = require('../models/LabelingTestResult');
const User = require('../models/User');
const { loadReferenceForClip } = require('./referenceAnnotations');
const { computeLabelingScore, PASS_THRESHOLD } = require('../utils/labelingScore');

async function gradeSubmissionAgainstReference(submission, assignment) {
  if (!assignment?.clipId) {
    throw new Error('Assignment has no clipId for auto scoring');
  }

  const reference = loadReferenceForClip(assignment.clipId, 'post');
  if (!reference.hasReference) {
    throw new Error('No reference annotations found for this clip');
  }

  const scoreResult = computeLabelingScore(
    submission.events,
    reference.events,
    assignment.fps || 25
  );

  submission.autoScore = scoreResult.totalScore;
  submission.autoScoreBreakdown = scoreResult.breakdown;
  await submission.save();

  return { scoreResult, reference };
}

async function recordLabelingTestAttempt(userId, assignmentId, submission, scoreResult) {
  const result = await LabelingTestResult.create({
    userId,
    assignmentId,
    submissionId: submission._id,
    score: scoreResult.totalScore,
    passed: scoreResult.passed,
    passThreshold: scoreResult.passThreshold,
    breakdown: scoreResult.breakdown,
    matchedCount: scoreResult.matchedCount,
    missingCount: scoreResult.missingCount,
    extraCount: scoreResult.extraCount,
    referenceEventCount: scoreResult.comparison.summary.totalReference,
  });

  const user = await User.findById(userId);
  user.labelingTestAttempts += 1;
  if (scoreResult.totalScore > user.bestLabelingTestScore) {
    user.bestLabelingTestScore = scoreResult.totalScore;
  }
  if (scoreResult.passed) {
    user.labelingTestPassed = true;
  }
  await user.save();

  return { result, user };
}

function canAccessPretest(user) {
  return user.status === 'passed_test' || user.status === 'approved';
}

function canAccessProduction(user) {
  if (user.status === 'approved') return true;
  return (
    user.status === 'passed_test' &&
    (user.labelingTestPassed || user.bestLabelingTestScore >= PASS_THRESHOLD)
  );
}

module.exports = {
  gradeSubmissionAgainstReference,
  recordLabelingTestAttempt,
  canAccessPretest,
  canAccessProduction,
  PASS_THRESHOLD,
};
