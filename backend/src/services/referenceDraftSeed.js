const LabelSubmission = require('../models/LabelSubmission');
const { FPS } = require('../config/frameOffsets');
const { normalizeLabelEvents } = require('../utils/normalizeLabelEvents');
const { loadReferenceForClip } = require('./referenceStorage');

function submissionFieldsFromReferenceEvents(events, fps = FPS) {
  return normalizeLabelEvents(events, fps).map(({ eventType, frameTime, playheadTime }) => ({
    eventType,
    frameTime,
    playheadTime: playheadTime ?? frameTime,
  }));
}

async function loadDraftEventsFromReference(assignment) {
  if (!assignment?.allowLabellerReference || !assignment?.clipId) {
    return [];
  }

  const reference = await loadReferenceForClip(assignment.clipId, 'post');
  if (!reference.hasReference || !reference.events?.length) {
    return [];
  }

  const fps = assignment.fps || FPS;
  return submissionFieldsFromReferenceEvents(reference.events, fps);
}

function shouldSeedDraftFromReference(submission) {
  if (!submission) return true;
  if (submission.events?.length > 0) return false;
  return submission.status === 'draft' || submission.status === 'rejected';
}

async function ensureDraftSeededFromReference(assignment, userId, existingSubmission = null) {
  if (!assignment?.allowLabellerReference || !shouldSeedDraftFromReference(existingSubmission)) {
    return existingSubmission;
  }

  const events = await loadDraftEventsFromReference(assignment);
  if (events.length === 0) {
    return existingSubmission;
  }

  const status =
    existingSubmission?.status === 'rejected' ? 'draft' : existingSubmission?.status || 'draft';

  return LabelSubmission.findOneAndUpdate(
    { assignmentId: assignment._id, userId },
    {
      assignmentId: assignment._id,
      userId,
      events,
      status,
    },
    { upsert: true, new: true, runValidators: true }
  );
}

module.exports = {
  loadDraftEventsFromReference,
  ensureDraftSeededFromReference,
  shouldSeedDraftFromReference,
  submissionFieldsFromReferenceEvents,
};
