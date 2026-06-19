const LabelingTestResult = require('../models/LabelingTestResult');
const User = require('../models/User');
const { loadReferenceForClip } = require('./referenceStorage');
const { computeLabelingScore, PASS_THRESHOLD } = require('../utils/labelingScore');
const { normalizeLabelEvents } = require('../utils/normalizeLabelEvents');
const {
  canAccessPretest,
  canAccessProduction,
  refreshLabelingTestPassed,
} = require('./onboarding');

async function gradeEventsAgainstReference(events, assignment) {
  if (!assignment?.clipId) {
    throw new Error('Assignment has no clipId for auto scoring');
  }

  const reference = await loadReferenceForClip(assignment.clipId, 'post');
  if (!reference.hasReference) {
    throw new Error('No reference annotations found for this clip');
  }

  const scoreResult = computeLabelingScore(
    normalizeLabelEvents(events),
    normalizeLabelEvents(reference.events),
    assignment.fps || 25
  );

  return { scoreResult, reference };
}

async function gradeSubmissionAgainstReference(submission, assignment) {
  const { scoreResult } = await gradeEventsAgainstReference(submission.events, assignment);

  submission.autoScore = scoreResult.totalScore;
  submission.autoScoreBreakdown = scoreResult.breakdown;
  await submission.save();

  return { scoreResult, reference: (await loadReferenceForClip(assignment.clipId, 'post')) };
}

async function ensureSubmissionAutoScore(submission, assignment) {
  if (submission?.autoScore != null || !assignment?.clipId) {
    return submission;
  }

  try {
    await gradeSubmissionAgainstReference(submission, assignment);
  } catch {
    // Reference may be missing — review can proceed manually.
  }

  return submission;
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
  await user.save();

  await refreshLabelingTestPassed(userId);
  const updatedUser = await User.findById(userId);

  return { result, user: updatedUser };
}

module.exports = {
  gradeEventsAgainstReference,
  gradeSubmissionAgainstReference,
  ensureSubmissionAutoScore,
  recordLabelingTestAttempt,
  canAccessPretest,
  canAccessProduction,
  PASS_THRESHOLD,
};
