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
  if (submission.status === 'submitted' || submission.status === 'approved') return false;
  return submission.status === 'draft' || submission.status === 'rejected';
}

async function initializeLabellerSubmission(assignment, userId) {
  const existing = await LabelSubmission.findOne({
    assignmentId: assignment._id,
    userId,
  });

  if (existing?.events?.length > 0) {
    return existing;
  }

  const seeded = await ensureDraftSeededFromReference(assignment, userId, existing);
  if (seeded) {
    return seeded;
  }

  if (!existing) {
    return LabelSubmission.findOneAndUpdate(
      { assignmentId: assignment._id, userId },
      {
        assignmentId: assignment._id,
        userId,
        events: [],
        status: 'draft',
      },
      { upsert: true, new: true, runValidators: true }
    );
  }

  return existing;
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

async function resetLabellerSubmissionFromReference(assignment, userId, { canEdit = true } = {}) {
  if (!assignment?.allowLabellerReference) {
    const error = new Error('Reference is not shared for this task');
    error.status = 403;
    throw error;
  }

  const events = await loadDraftEventsFromReference(assignment);
  if (events.length === 0) {
    const error = new Error('No reference events available for this task');
    error.status = 400;
    throw error;
  }

  if (!canEdit) {
    const error = new Error('This submission cannot be reset');
    error.status = 403;
    throw error;
  }

  return LabelSubmission.findOneAndUpdate(
    { assignmentId: assignment._id, userId },
    {
      assignmentId: assignment._id,
      userId,
      events,
      status: 'draft',
      eventValidations: [],
    },
    { upsert: true, new: true, runValidators: true }
  );
}

module.exports = {
  loadDraftEventsFromReference,
  ensureDraftSeededFromReference,
  initializeLabellerSubmission,
  resetLabellerSubmissionFromReference,
  shouldSeedDraftFromReference,
  submissionFieldsFromReferenceEvents,
};
