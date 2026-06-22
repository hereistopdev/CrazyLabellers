const express = require('express');
const VideoAssignment = require('../models/VideoAssignment');
const LabelSubmission = require('../models/LabelSubmission');
const { auth, requireRole } = require('../middleware/auth');
const { isLabeller, isAdmin } = require('../config/roles');
const { normalizeLabelEvents } = require('../utils/normalizeLabelEvents');
const {
  gradeSubmissionAgainstReference,
  recordLabelingTestAttempt,
} = require('../services/grading');
const {
  canAccessTutorial,
  canAccessPretest,
  canAccessProduction,
  hasPassedKnowledgeTest,
  isPretestClipForUser,
  getPretestClipsWithProgress,
  getLabelingTestClipProgress,
} = require('../services/onboarding');
const { loadReferenceForClip } = require('../services/referenceStorage');
const {
  assertLabellerProductionAssignment,
  canLabellerRelabelWithReference,
  canLabellerEditSubmission,
  isAssignedLabeller,
} = require('../services/labellerAssignmentAccess');
const {
  ensureDraftSeededFromReference,
  initializeLabellerSubmission,
} = require('../services/referenceDraftSeed');

const router = express.Router();

async function patchAssignment(id, fields) {
  await VideoAssignment.updateOne({ _id: id }, { $set: fields });
}

router.get('/', auth, async (req, res) => {
  try {
    let filter = {};
    const kind = req.query.kind;

    if (isLabeller(req.user)) {
      if (!hasPassedKnowledgeTest(req.user) && req.user.status !== 'approved') {
        return res.status(403).json({
          message: 'You must pass the knowledge test before accessing labeling assignments',
        });
      }

      if (kind === 'tutorial') {
        if (!canAccessTutorial(req.user)) {
          return res.status(403).json({ message: 'Pass the knowledge test first' });
        }
        filter = { kind: 'tutorial' };
      } else if (kind === 'pretest') {
        if (!canAccessPretest(req.user)) {
          return res.status(403).json({
            message: 'Complete the knowledge test and tutorials before the video pre-test',
          });
        }
        const pretestClips = await getPretestClipsWithProgress(req.user._id);
        return res.json(pretestClips);
      } else {
        if (!canAccessProduction(req.user)) {
          return res.status(403).json({
            message:
              'Pass the labeling pre-test with 80/100 or higher before accessing real tasks',
          });
        }
        filter = {
          kind: { $nin: ['tutorial', 'pretest'] },
          $or: [{ assignedTo: req.user._id }, { status: 'available' }],
        };
      }
    } else if (kind) {
      filter.kind = kind;
    }

    const assignments = await VideoAssignment.find(filter)
      .populate('assignedTo', 'name email')
      .populate('groupId', 'name description sortOrder')
      .sort({ sortOrder: 1, createdAt: -1 });
    return res.json(assignments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const assignment = await VideoAssignment.findById(req.params.id).populate(
      'assignedTo',
      'name email'
    );
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (isLabeller(req.user)) {
      const kind = assignment.kind || 'production';

      if (kind === 'tutorial') {
        if (!canAccessTutorial(req.user)) {
          return res.status(403).json({ message: 'Pass the knowledge test first' });
        }
        return res.json(assignment);
      }

      if (kind === 'pretest') {
        if (!canAccessPretest(req.user)) {
          return res.status(403).json({ message: 'Complete tutorials before pre-test' });
        }
        const User = require('../models/User');
        const user = await User.findById(req.user._id);
        if (!isPretestClipForUser(user, assignment._id)) {
          return res.status(403).json({ message: 'This pre-test clip is not assigned to you' });
        }
        return res.json(assignment);
      }
      if (kind === 'production' && !canAccessProduction(req.user)) {
        return res.status(403).json({
          message: 'Pass the labeling pre-test (80/100+) before real tasks',
        });
      }
    }

    return res.json(assignment);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const assignment = await VideoAssignment.create(req.body);
    return res.status(201).json(assignment);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.post('/:id/claim', auth, async (req, res) => {
  try {
    if (!hasPassedKnowledgeTest(req.user) && req.user.status !== 'approved') {
      return res.status(403).json({ message: 'Pass the knowledge test first' });
    }

    const assignment = await VideoAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (assignment.kind === 'tutorial' && !canAccessTutorial(req.user)) {
      return res.status(403).json({ message: 'Pass the knowledge test first' });
    }
    if (assignment.kind === 'pretest' && !canAccessPretest(req.user)) {
      return res.status(403).json({ message: 'Complete tutorials before the video pre-test' });
    }
    if (assignment.kind === 'production' && !canAccessProduction(req.user)) {
      return res.status(403).json({
        message: 'Pass the video pre-test (80/100+) before claiming real tasks',
      });
    }

    if (assignment.kind === 'tutorial') {
      return res.json({
        ...assignment.toObject(),
        message: 'Tutorials are open to all labellers — no claim required',
      });
    }

    if (assignment.kind === 'pretest') {
      const User = require('../models/User');
      const user = await User.findById(req.user._id);
      if (!isPretestClipForUser(user, assignment._id)) {
        return res.status(403).json({ message: 'This clip is not in your pre-test set' });
      }

      return res.json({
        ...assignment.toObject(),
        message: 'Pre-test clips are open in your personal set — no claim required',
      });
    }

    if (assignment.status !== 'available') {
      return res.status(400).json({ message: 'Assignment is not available' });
    }

    await patchAssignment(assignment._id, {
      assignedTo: req.user._id,
      status: 'assigned',
    });
    assignment.assignedTo = req.user._id;
    assignment.status = 'assigned';

    await initializeLabellerSubmission(assignment, req.user._id);

    return res.json(assignment);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/:id/reference', auth, async (req, res) => {
  try {
    const assignment = await VideoAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (isLabeller(req.user) && !isAdmin(req.user)) {
      if (!assignment.allowLabellerReference) {
        return res.status(403).json({ message: 'Reference is not shared for this task' });
      }
      assertLabellerProductionAssignment(req.user, assignment);
    }

    if (!assignment.clipId) {
      return res.json({ hasReference: false, events: [], annotationCount: 0 });
    }

    const reference = await loadReferenceForClip(assignment.clipId, 'post');
    return res.json({
      hasReference: reference.hasReference,
      events: reference.events || [],
      annotationCount: reference.annotationCount || 0,
      variant: reference.variant || 'post',
    });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.get('/:id/export', auth, async (req, res) => {
  try {
    const assignment = await VideoAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (
      isLabeller(req.user) &&
      !isAdmin(req.user) &&
      assignment.kind === 'pretest' &&
      !isPretestClipForUser(req.user, assignment._id)
    ) {
      return res.status(403).json({ message: 'This pre-test clip is not assigned to you' });
    }

    if (
      isLabeller(req.user) &&
      !isAdmin(req.user) &&
      assignment.kind !== 'tutorial' &&
      assignment.kind !== 'pretest' &&
      assignment.assignedTo?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'You are not assigned to this video' });
    }

    if (!assignment.clipId) {
      return res.status(400).json({ message: 'Assignment has no clipId for export' });
    }

    const filter = { assignmentId: req.params.id };
    if (isLabeller(req.user)) {
      filter.userId = req.user._id;
    }

    const submission = await LabelSubmission.findOne(filter);
    if (!submission) {
      return res.status(404).json({ message: 'No labels found' });
    }

    const { exportAnnotation, getExportFilename } = require('../utils/exportAnnotation');
    const variant = req.query.variant === 'raw' ? 'raw' : 'post';
    const payload = exportAnnotation(submission.events, {
      gameTime: assignment.gameTime || '1 - 00:00',
      variant,
    });
    const filename = getExportFilename(assignment.clipId, variant);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(payload, null, 2));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/:id/labels', auth, async (req, res) => {
  try {
    const filter = { assignmentId: req.params.id };
    if (isLabeller(req.user)) {
      filter.userId = req.user._id;
    }

    let submission = await LabelSubmission.findOne(filter).populate('userId', 'name email');

    if (isLabeller(req.user) && !isAdmin(req.user)) {
      const assignment = await VideoAssignment.findById(req.params.id);
      if (assignment) {
        submission = await ensureDraftSeededFromReference(
          assignment,
          req.user._id,
          submission
        );
        if (submission && submission.userId && !submission.userId.email) {
          await submission.populate('userId', 'name email');
        }
      }
    }

    if (!submission) {
      return res.json({ events: [], status: 'draft' });
    }
    const payload = submission.toObject ? submission.toObject() : submission;
    return res.json({
      ...payload,
      events: normalizeLabelEvents(payload.events || []),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put('/:id/labels', auth, async (req, res) => {
  try {
    const { events, status } = req.body;
    const assignment = await VideoAssignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (
      isLabeller(req.user) &&
      !isAdmin(req.user) &&
      assignment.kind === 'pretest' &&
      !isPretestClipForUser(req.user, assignment._id)
    ) {
      return res.status(403).json({ message: 'This pre-test clip is not assigned to you' });
    }

    if (
      isLabeller(req.user) &&
      !isAdmin(req.user) &&
      assignment.kind !== 'tutorial' &&
      assignment.kind !== 'pretest' &&
      assignment.assignedTo?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'You are not assigned to this video' });
    }

    if (status === 'submitted' && isAdmin(req.user)) {
      return res.status(400).json({ message: 'Admins cannot submit assignments as labellers' });
    }

    if (assignment.kind === 'tutorial' && isLabeller(req.user) && !isAdmin(req.user)) {
      return res.status(400).json({
        message: 'Tutorials are not submitted for review. Use Mark tutorial complete instead.',
      });
    }

    if (
      isLabeller(req.user) &&
      !isAdmin(req.user) &&
      assignment.kind !== 'tutorial' &&
      assignment.kind !== 'pretest'
    ) {
      if (!isAssignedLabeller(req.user, assignment)) {
        return res.status(403).json({ message: 'You are not assigned to this video' });
      }
    }

    const normalizedEvents = normalizeLabelEvents(events || []);

    const existing = await LabelSubmission.findOne({
      assignmentId: req.params.id,
      userId: req.user._id,
    });

    if (
      isLabeller(req.user) &&
      !isAdmin(req.user) &&
      assignment.kind === 'pretest'
    ) {
      if (existing?.status === 'submitted') {
        if (status === 'submitted') {
          return res.status(400).json({ message: 'Pre-test already submitted for this clip' });
        }
        return res.status(403).json({
          message: 'This pre-test clip is already submitted and cannot be edited',
        });
      }
    }

    const relabelWithReference = canLabellerRelabelWithReference(assignment, existing);

    if (
      isLabeller(req.user) &&
      !isAdmin(req.user) &&
      assignment.kind !== 'tutorial' &&
      assignment.kind !== 'pretest' &&
      existing &&
      !canLabellerEditSubmission(assignment, existing)
    ) {
      if (existing.status === 'approved') {
        return res.status(403).json({ message: 'This submission is approved and cannot be edited' });
      }
      return res.status(403).json({
        message: 'This task was rejected. Contact an admin if you need to re-label.',
      });
    }

    const updatePayload = {
      events: normalizedEvents,
      status: status || 'draft',
    };

    const isProductionResubmit =
      status === 'submitted' &&
      existing?.status === 'submitted' &&
      assignment.kind !== 'pretest' &&
      assignment.kind !== 'tutorial';

    if (status === 'submitted') {
      updatePayload.originalEvents = normalizedEvents;
      if (relabelWithReference && existing?.status === 'rejected') {
        updatePayload.eventValidations = [];
      }
      if (isProductionResubmit) {
        updatePayload.eventValidations = [];
        updatePayload.reviewerNotes = '';
        updatePayload.reviewPoints = null;
        updatePayload.reviewedAt = null;
        updatePayload.reviewedBy = null;
      }
    }

    const submission = await LabelSubmission.findOneAndUpdate(
      { assignmentId: req.params.id, userId: req.user._id },
      updatePayload,
      { upsert: true, new: true, runValidators: true }
    );

    let grading = null;

    if (status === 'submitted') {
      if (assignment.kind !== 'pretest') {
        await patchAssignment(assignment._id, { status: 'submitted' });
      }

      try {
        const { scoreResult } = await gradeSubmissionAgainstReference(submission, assignment);
        grading = {
          autoScore: scoreResult.totalScore,
          passed: scoreResult.passed,
          passThreshold: scoreResult.passThreshold,
          breakdown: scoreResult.breakdown,
          matchedCount: scoreResult.matchedCount,
          missingCount: scoreResult.missingCount,
          extraCount: scoreResult.extraCount,
          referenceEventCount: scoreResult.comparison.summary.totalReference,
          pointsPerEvent: scoreResult.pointsPerEvent,
        };

        if (assignment.kind === 'pretest') {
          const { user } = await recordLabelingTestAttempt(
            req.user._id,
            assignment._id,
            submission,
            scoreResult
          );
          const clipProgress = await getLabelingTestClipProgress(req.user._id, user);
          grading.clipPassed = scoreResult.passed;
          grading.clipsPassed = clipProgress.clipsPassed;
          grading.clipsRequired = clipProgress.clipsRequired;
          grading.allClipsPassed = clipProgress.allPassed;
          grading.user = {
            bestLabelingTestScore: user.bestLabelingTestScore,
            labelingTestPassed: user.labelingTestPassed,
            canAccessProduction: canAccessProduction(user),
          };
          grading.scoreReviewUrl = `/labeling-test/${assignment._id}/review`;
        } else if (assignment.kind === 'production' || !assignment.kind) {
          grading.suggestedReviewPoints = scoreResult.totalScore;
        }
      } catch (gradeError) {
        grading = { error: gradeError.message };
      }
    } else if (
      assignment.kind !== 'tutorial' &&
      assignment.kind !== 'pretest' &&
      (assignment.status === 'assigned' ||
        assignment.status === 'rejected' ||
        assignment.status === 'submitted')
    ) {
      await patchAssignment(assignment._id, { status: 'in_progress' });
    }

    return res.json({ submission, grading });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

module.exports = router;
