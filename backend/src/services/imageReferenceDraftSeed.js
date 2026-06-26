const ImageKeypointSubmission = require('../models/ImageKeypointSubmission');
const { loadReferenceForImage } = require('./imageReferenceStorage');

function shouldSeedDraftFromReference(submission) {
  if (!submission) return true;
  if (submission.keypoints?.length > 0) return false;
  if (submission.status === 'submitted' || submission.status === 'approved') return false;
  return submission.status === 'draft' || submission.status === 'rejected';
}

async function loadDraftKeypointsFromReference(assignment) {
  if (!assignment?.allowLabellerReference || !assignment?.hasReference) {
    return [];
  }

  const reference = await loadReferenceForImage(assignment.imageId);
  return reference.hasReference ? reference.keypoints : [];
}

async function ensureImageSubmissionSeeded(assignment, userId, existingSubmission = null) {
  if (!assignment?.allowLabellerReference || !shouldSeedDraftFromReference(existingSubmission)) {
    return existingSubmission;
  }

  const keypoints = await loadDraftKeypointsFromReference(assignment);
  if (keypoints.length === 0) {
    return existingSubmission;
  }

  const status =
    existingSubmission?.status === 'rejected' ? 'draft' : existingSubmission?.status || 'draft';

  return ImageKeypointSubmission.findOneAndUpdate(
    { assignmentId: assignment._id, userId },
    {
      assignmentId: assignment._id,
      userId,
      keypoints,
      status,
    },
    { upsert: true, new: true, runValidators: true }
  );
}

async function reseedEligibleSubmissionsFromReference(assignment) {
  if (!assignment?.allowLabellerReference) {
    return 0;
  }

  const keypoints = await loadDraftKeypointsFromReference(assignment);
  if (keypoints.length === 0) {
    return 0;
  }

  let reseeded = 0;
  const submissions = await ImageKeypointSubmission.find({ assignmentId: assignment._id });

  for (const existing of submissions) {
    if (!shouldSeedDraftFromReference(existing)) continue;

    await ImageKeypointSubmission.findOneAndUpdate(
      { _id: existing._id },
      {
        keypoints,
        status: existing.status === 'rejected' ? 'draft' : existing.status || 'draft',
      }
    );
    reseeded += 1;
  }

  if (assignment.assignedTo) {
    const assignedId = assignment.assignedTo._id || assignment.assignedTo;
    const hasSubmission = submissions.some((row) => String(row.userId) === String(assignedId));
    if (!hasSubmission) {
      await ensureImageSubmissionSeeded(assignment, assignedId, null);
      reseeded += 1;
    }
  }

  return reseeded;
}

module.exports = {
  loadDraftKeypointsFromReference,
  ensureImageSubmissionSeeded,
  reseedEligibleSubmissionsFromReference,
  shouldSeedDraftFromReference,
};
