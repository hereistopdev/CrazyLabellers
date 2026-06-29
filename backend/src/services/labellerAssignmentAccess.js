const { isLabeller, isAdmin } = require('../config/roles');

function isAssignedLabeller(user, assignment) {
  if (!user?._id || !assignment?.assignedTo) return false;
  const assignedId =
    assignment.assignedTo._id?.toString?.() || assignment.assignedTo.toString();
  return assignedId === user._id.toString();
}

function canLabellerRelabelWithReference(assignment, submission) {
  if (!assignment?.allowLabellerReference) return false;
  if (assignment.status === 'rejected' || submission?.status === 'rejected') return true;
  if (!submission || submission.status === 'draft') return true;
  return false;
}

function canLabellerEditSubmission(assignment, submission) {
  if (!submission) return true;
  if (submission.status === 'approved') return false;
  if (submission.status === 'rejected') {
    return Boolean(assignment?.allowLabellerReference);
  }
  return submission.status === 'draft' || submission.status === 'submitted';
}

function canLabellerViewReference(user, assignment, submission) {
  if (!assignment) return false;
  if (!isLabeller(user) || isAdmin(user)) return true;
  if (!isAssignedLabeller(user, assignment)) return false;
  if (assignment.allowLabellerReference) return true;
  if (submission?.status === 'approved' || assignment.status === 'approved') return true;
  return false;
}

function canLabellerViewApprovedWork(user, assignment, submission) {
  if (!isLabeller(user) || isAdmin(user)) return false;
  if (!isAssignedLabeller(user, assignment)) return false;
  return submission?.status === 'approved' || assignment.status === 'approved';
}

function assertLabellerProductionAssignment(user, assignment) {
  if (!isLabeller(user) || isAdmin(user)) return;

  if (assignment.kind !== 'production' && assignment.kind) {
    return;
  }

  if (!isAssignedLabeller(user, assignment)) {
    const error = new Error('You are not assigned to this video');
    error.status = 403;
    throw error;
  }
}

module.exports = {
  isAssignedLabeller,
  canLabellerRelabelWithReference,
  canLabellerEditSubmission,
  canLabellerViewReference,
  canLabellerViewApprovedWork,
  assertLabellerProductionAssignment,
};
