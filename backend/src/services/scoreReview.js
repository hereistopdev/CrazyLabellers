const { loadReferenceForClip } = require('./referenceStorage');
const { compareAnnotations, buildEventReviewRows } = require('../utils/compareAnnotations');
const { normalizeLabelEvents } = require('../utils/normalizeLabelEvents');
const { ensureSubmissionAutoScore } = require('./grading');

async function buildScoreReviewPayload(submission, assignment, { ensureScore = true } = {}) {
  if (ensureScore && submission?._id) {
    await ensureSubmissionAutoScore(submission, assignment);
  }

  const reference = assignment?.clipId
    ? await loadReferenceForClip(assignment.clipId, 'post')
    : { hasReference: false, events: [] };

  const submissionEvents = normalizeLabelEvents(submission?.events || []);
  const referenceEvents = normalizeLabelEvents(reference.events || []);
  const comparison = reference.hasReference
    ? compareAnnotations(submissionEvents, referenceEvents)
    : null;

  const eventRows = buildEventReviewRows(
    submissionEvents,
    comparison,
    submission?.eventValidations || []
  );

  return {
    submission: {
      _id: submission._id,
      events: submissionEvents,
      originalEvents: normalizeLabelEvents(submission?.originalEvents || []),
      status: submission.status,
      autoScore: submission.autoScore,
      autoScoreBreakdown: submission.autoScoreBreakdown,
      correctionBreakdown: submission.correctionBreakdown,
      correctedBy: submission.correctedBy,
      correctedAt: submission.correctedAt,
      pretestScoreReviewSeenAt: submission.pretestScoreReviewSeenAt,
      updatedAt: submission.updatedAt,
    },
    assignment,
    autoScore: submission?.autoScore,
    autoScoreBreakdown: submission?.autoScoreBreakdown,
    correctionBreakdown: submission?.correctionBreakdown,
    passThreshold: 80,
    reference: {
      hasReference: reference.hasReference,
      events: referenceEvents,
      variant: reference.variant,
      annotationCount: reference.annotationCount || 0,
      source: reference.source,
    },
    comparison,
    eventRows,
    missingReferenceEvents: comparison?.missingInSubmission || [],
    extraSubmissionEvents: comparison?.extraInSubmission || [],
  };
}

module.exports = { buildScoreReviewPayload };
