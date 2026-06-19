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
  assertLabellerProductionAssignment,
};
