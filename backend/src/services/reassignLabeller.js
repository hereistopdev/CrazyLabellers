const LabelSubmission = require('../models/LabelSubmission');
const User = require('../models/User');
const { LABELLER_ROLES } = require('../config/roles');
const { initializeLabellerSubmission } = require('./referenceDraftSeed');

const ELIGIBLE_LABELLER_STATUSES = ['passed_test', 'approved'];

function assignmentStatusFromSubmission(submission) {
  if (!submission) return 'assigned';
  if (submission.status === 'approved') return 'approved';
  if (submission.status === 'rejected') return 'rejected';
  if (submission.status === 'submitted') return 'submitted';
  if (submission.events?.length > 0) return 'in_progress';
  return 'assigned';
}

async function transferSubmissionToLabeller(assignmentId, fromUserId, toUserId) {
  if (!fromUserId || String(fromUserId) === String(toUserId)) {
    return null;
  }

  const source = await LabelSubmission.findOne({
    assignmentId,
    userId: fromUserId,
  });
  if (!source) {
    return null;
  }

  const target = await LabelSubmission.findOne({
    assignmentId,
    userId: toUserId,
  });
  if (target) {
    await LabelSubmission.deleteOne({ _id: target._id });
  }

  source.userId = toUserId;
  await source.save();
  return source;
}

async function assertEligibleLabeller(labellerId) {
  const labeller = await User.findOne({
    _id: labellerId,
    role: { $in: LABELLER_ROLES },
    status: { $in: ELIGIBLE_LABELLER_STATUSES },
  });

  if (!labeller) {
    const error = new Error('Labeller not found or not eligible for production tasks');
    error.status = 404;
    throw error;
  }

  return labeller;
}

async function reassignTaskLabeller(assignment, newLabellerId) {
  if (assignment.kind === 'tutorial') {
    const error = new Error(
      'Tutorial clips are open to all labellers for study — they cannot be assigned'
    );
    error.status = 400;
    throw error;
  }

  if (assignment.kind === 'pretest') {
    const error = new Error(
      'Pre-test clips stay in the shared pool — each labeller gets random picks automatically'
    );
    error.status = 400;
    throw error;
  }

  const previousUserId = assignment.assignedTo;

  if (!newLabellerId) {
    assignment.assignedTo = null;
    assignment.status = 'available';
    await assignment.save();
    return { assignment, submission: null, transferred: false };
  }

  await assertEligibleLabeller(newLabellerId);

  if (previousUserId && String(previousUserId) === String(newLabellerId)) {
    const submission = await LabelSubmission.findOne({
      assignmentId: assignment._id,
      userId: newLabellerId,
    });
    return { assignment, submission, transferred: false };
  }

  let submission = null;
  let transferred = false;

  if (previousUserId) {
    submission = await transferSubmissionToLabeller(
      assignment._id,
      previousUserId,
      newLabellerId
    );
    transferred = Boolean(submission);
  }

  if (!submission) {
    submission = await initializeLabellerSubmission(assignment, newLabellerId);
  }

  assignment.assignedTo = newLabellerId;
  assignment.status = assignmentStatusFromSubmission(submission);
  await assignment.save();

  return { assignment, submission, transferred };
}

module.exports = {
  reassignTaskLabeller,
  transferSubmissionToLabeller,
  assignmentStatusFromSubmission,
  ELIGIBLE_LABELLER_STATUSES,
};
