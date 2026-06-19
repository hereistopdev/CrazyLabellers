const express = require('express');
const LabelSubmission = require('../models/LabelSubmission');
const VideoAssignment = require('../models/VideoAssignment');
const PaymentSettings = require('../models/PaymentSettings');
const { auth } = require('../middleware/auth');
const { isReviewer, canAccessReview } = require('../config/roles');
const { calculateTaskEarnings, DEFAULT_RATE_PER_POINT, clampReviewPoints } = require('../config/payments');
const { upsertLabellerReview } = require('../services/labellerProfile');
const { processApprovalBadges } = require('../services/labellerBadges');
const { loadReferenceForClip, saveReferenceEventsForClip } = require('../services/referenceStorage');
const { compareAnnotations } = require('../utils/compareAnnotations');
const { buildScoreReviewPayload } = require('../services/scoreReview');
const { gradeSubmissionAgainstReference, gradeEventsAgainstReference } = require('../services/grading');
const { applyCorrectionScore, buildCorrectionBreakdown } = require('../services/submissionCorrections');
const { normalizeLabelEvents } = require('../utils/normalizeLabelEvents');
const { EVENT_TYPES } = require('../config/events');

const router = express.Router();

async function loadAssignmentForReview(id) {
  return VideoAssignment.findById(id)
    .populate('uploadedBy', 'name email')
    .populate('referenceUpdatedBy', 'name email')
    .populate('reviewedBy', 'name email');
}

function requireReviewerRole(req, res, next) {
  if (!isReviewer(req.user)) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  if (!canAccessReview(req.user)) {
    return res.status(403).json({
      message: 'Your validator account is pending admin approval before you can review tasks',
    });
  }
  return next();
}

async function buildReviewPayload(submission, assignment, variant = 'post', { preview = false } = {}) {
  const payload = await buildScoreReviewPayload(submission, assignment, { ensureScore: !preview });
  return {
    ...payload,
    preview,
    submission,
  };
}

router.get('/assignments', auth, requireReviewerRole, async (_req, res) => {
  try {
    const assignments = await VideoAssignment.find({ clipId: { $exists: true, $ne: null } })
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    const clipIds = assignments.map((a) => a.clipId).filter(Boolean);
    const references = await Promise.all(
      clipIds.map(async (clipId) => ({
        clipId,
        hasReference: (await loadReferenceForClip(clipId)).hasReference,
      }))
    );
    const refMap = new Map(references.map((r) => [r.clipId, r.hasReference]));

    const submissionCounts = await LabelSubmission.aggregate([
      { $match: { assignmentId: { $in: assignments.map((a) => a._id) } } },
      { $group: { _id: '$assignmentId', count: { $sum: 1 } } },
    ]);
    const subMap = new Map(submissionCounts.map((s) => [String(s._id), s.count]));

    return res.json(
      assignments.map((a) => ({
        ...a.toObject(),
        hasReference: refMap.get(a.clipId) || false,
        submissionCount: subMap.get(String(a._id)) || 0,
      }))
    );
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/assignments/:id/preview', auth, requireReviewerRole, async (req, res) => {
  try {
    const assignment = await loadAssignmentForReview(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const variant = req.query.variant === 'raw' ? 'raw' : 'post';
    const emptySubmission = {
      events: [],
      eventValidations: [],
      status: 'preview',
      userId: null,
    };

    return res.json(await buildReviewPayload(emptySubmission, assignment, variant, { preview: true }));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/submissions', auth, requireReviewerRole, async (req, res) => {
  try {
    const status = req.query.status || 'submitted';
    const filter = status === 'all' ? {} : { status };

    const submissions = await LabelSubmission.find(filter)
      .populate('userId', 'name email status')
      .populate('assignmentId', 'title videoUrl clipId taskPrice challengeNote kind')
      .sort({ updatedAt: -1 });

    const reviewable = submissions.filter(
      (s) => s.assignmentId && !['tutorial', 'pretest'].includes(s.assignmentId.kind)
    );

    return res.json(reviewable);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/submissions/:id', auth, requireReviewerRole, async (req, res) => {
  try {
    const submission = await LabelSubmission.findById(req.params.id)
      .populate('userId', 'name email status')
      .populate('reviewedBy', 'name email');

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const assignment = await loadAssignmentForReview(submission.assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const variant = req.query.variant === 'raw' ? 'raw' : 'post';
    return res.json(await buildReviewPayload(submission, assignment, variant));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch('/assignments/:id/reference', auth, requireReviewerRole, async (req, res) => {
  try {
    const { events, submissionId, variant = 'post' } = req.body;
    if (!Array.isArray(events)) {
      return res.status(400).json({ message: 'events must be an array' });
    }

    for (const event of events) {
      if (!EVENT_TYPES.includes(event.eventType)) {
        return res.status(400).json({ message: `Invalid event type: ${event.eventType}` });
      }
      if (!Number.isFinite(event.frameTime)) {
        return res.status(400).json({ message: 'Each event must have a numeric frameTime' });
      }
    }

    const assignment = await loadAssignmentForReview(req.params.id);
    if (!assignment?.clipId) {
      return res.status(404).json({ message: 'Assignment not found or has no clip ID' });
    }

    const refVariant = variant === 'raw' ? 'raw' : 'post';
    await saveReferenceEventsForClip(assignment.clipId, events, {
      variant: refVariant,
      gameTime: assignment.gameTime || '1 - 00:00',
      sourceFilename: 'review-edit',
    });

    await VideoAssignment.findByIdAndUpdate(assignment._id, {
      referenceUpdatedBy: req.user._id,
      referenceUpdatedAt: new Date(),
    });

    const refVariantForPayload = refVariant;
    let submission = null;

    if (submissionId) {
      submission = await LabelSubmission.findById(submissionId)
        .populate('userId', 'name email status')
        .populate('reviewedBy', 'name email');
      if (submission) {
        await gradeSubmissionAgainstReference(submission, assignment);
      }
    }

    if (submission) {
      return res.json(
        await buildReviewPayload(submission, assignment, refVariantForPayload, { ensureScore: false })
      );
    }

    const emptySubmission = {
      events: [],
      eventValidations: [],
      status: 'preview',
      userId: null,
    };
    return res.json(
      await buildReviewPayload(emptySubmission, assignment, refVariantForPayload, {
        preview: true,
        ensureScore: false,
      })
    );
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.patch('/submissions/:id/events', auth, requireReviewerRole, async (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events)) {
      return res.status(400).json({ message: 'events must be an array' });
    }

    for (const event of events) {
      if (!EVENT_TYPES.includes(event.eventType)) {
        return res.status(400).json({ message: `Invalid event type: ${event.eventType}` });
      }
      if (!Number.isFinite(event.frameTime)) {
        return res.status(400).json({ message: 'Each event must have a numeric frameTime' });
      }
    }

    const submission = await LabelSubmission.findById(req.params.id)
      .populate('userId', 'name email status')
      .populate('reviewedBy', 'name email');

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const assignment = await loadAssignmentForReview(submission.assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (!submission.originalEvents?.length) {
      submission.originalEvents = normalizeLabelEvents(submission.events || []);
    }

    const normalizedEvents = normalizeLabelEvents(events);
    const originalEvents = submission.originalEvents?.length
      ? submission.originalEvents
      : normalizeLabelEvents(submission.events || []);

    submission.events = normalizedEvents;
    submission.correctedBy = req.user._id;
    submission.correctedAt = new Date();

    const reference = assignment.clipId
      ? await loadReferenceForClip(assignment.clipId, 'post')
      : { hasReference: false };

    const correction = buildCorrectionBreakdown(originalEvents, normalizedEvents, assignment?.fps || 25);
    submission.correctionBreakdown = {
      frameAdjustments: correction.frameAdjustments,
      missedAdded: correction.missedAdded,
      wrongRemoved: correction.wrongRemoved,
      totalCorrections: correction.totalCorrections,
    };

    if (reference.hasReference) {
      const { scoreResult } = await gradeEventsAgainstReference(originalEvents, assignment);
      submission.autoScore = scoreResult.totalScore;
      submission.autoScoreBreakdown = scoreResult.breakdown;
    } else {
      applyCorrectionScore(submission, normalizedEvents, assignment);
    }

    await submission.save();

    const payload = await buildReviewPayload(submission, assignment, 'post', { ensureScore: false });
    return res.json(payload);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.patch('/submissions/:id/validate', auth, requireReviewerRole, async (req, res) => {
  try {
    const { eventIndex, status, validateAll, autoFromComparison, variant = 'post' } = req.body;

    if (!['valid', 'invalid', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Status must be valid, invalid, or pending' });
    }

    const submission = await LabelSubmission.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const assignment = await loadAssignmentForReview(submission.assignmentId);
    const now = new Date();
    const validations = [...(submission.eventValidations || [])];
    const validationMap = new Map(validations.map((item) => [item.eventIndex, { ...item }]));

    const upsertValidation = (index, nextStatus) => {
      validationMap.set(index, {
        eventIndex: index,
        status: nextStatus,
        notes: validationMap.get(index)?.notes || '',
        validatedAt: now,
        validatedBy: req.user._id,
      });
    };

    if (autoFromComparison && assignment?.clipId) {
      const reference = await loadReferenceForClip(
        assignment.clipId,
        variant === 'raw' ? 'raw' : 'post'
      );
      if (reference.hasReference) {
        const comparison = compareAnnotations(submission.events, reference.events);
        const matchedIndexes = new Set(
          comparison.matched.map((item) => item.submissionIndex)
        );

        submission.events.forEach((_, index) => {
          upsertValidation(index, matchedIndexes.has(index) ? 'valid' : 'invalid');
        });
      }
    } else if (validateAll) {
      submission.events.forEach((_, index) => {
        upsertValidation(index, status);
      });
    } else if (typeof eventIndex === 'number') {
      if (eventIndex < 0 || eventIndex >= submission.events.length) {
        return res.status(400).json({ message: 'Invalid event index' });
      }
      upsertValidation(eventIndex, status);
    } else {
      return res.status(400).json({ message: 'Provide eventIndex or validateAll' });
    }

    submission.eventValidations = Array.from(validationMap.values()).sort(
      (a, b) => a.eventIndex - b.eventIndex
    );
    await submission.save();

    const payload = await buildReviewPayload(
      submission,
      assignment,
      variant === 'raw' ? 'raw' : 'post'
    );
    return res.json(payload);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.patch('/submissions/:id/review', auth, requireReviewerRole, async (req, res) => {
  try {
    const { status, reviewerNotes, reviewPoints, rating, reviewComment, aspects } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    let settings = await PaymentSettings.findOne();
    if (!settings) {
      settings = await PaymentSettings.create({ ratePerPoint: DEFAULT_RATE_PER_POINT });
    }

    const submissionDoc = await LabelSubmission.findById(req.params.id);
    if (!submissionDoc) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const assignment = await loadAssignmentForReview(submissionDoc.assignmentId);
    const points = status === 'approved' ? clampReviewPoints(parseInt(reviewPoints, 10) || 0) : 0;
    const earnings =
      status === 'approved'
        ? calculateTaskEarnings(points, assignment?.taskPrice, settings.ratePerPoint, assignment?.kind)
        : 0;

    const submission = await LabelSubmission.findByIdAndUpdate(
      req.params.id,
      {
        status,
        reviewerNotes: reviewerNotes || '',
        reviewPoints: status === 'approved' ? points : 0,
        earnings,
        reviewedAt: new Date(),
        reviewedBy: req.user._id,
      },
      { new: true }
    )
      .populate('userId', 'name email')
      .populate('reviewedBy', 'name email');

    if (submission.assignmentId) {
      await VideoAssignment.findByIdAndUpdate(submission.assignmentId, {
        status: status === 'approved' ? 'approved' : 'rejected',
        reviewedBy: req.user._id,
        reviewedAt: new Date(),
      });
    }

    if (status === 'approved' && rating != null) {
      const starRating = Math.max(1, Math.min(5, parseInt(rating, 10) || 0));
      if (starRating >= 1) {
        await upsertLabellerReview({
          labellerId: submission.userId._id || submission.userId,
          submissionId: submission._id,
          reviewerId: req.user._id,
          rating: starRating,
          comment: reviewComment || reviewerNotes || '',
          aspects: aspects || undefined,
          assignmentTitle: assignment?.title || '',
          taskPrice: assignment?.taskPrice,
          reviewPoints: points,
          earnings,
        });
      }
    }

    let newBadges = [];
    if (status === 'approved') {
      newBadges = await processApprovalBadges(
        submission.userId._id || submission.userId,
        assignment?.kind
      );
    }

    const payload = await buildReviewPayload(submission, assignment);
    return res.json({ ...payload, newBadges });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

module.exports = router;
