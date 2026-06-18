const express = require('express');
const VideoAssignment = require('../models/VideoAssignment');
const LabelSubmission = require('../models/LabelSubmission');
const { auth, requireRole } = require('../middleware/auth');
const { isLabeller, isAdmin } = require('../config/roles');
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
} = require('../services/onboarding');

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
        const { ensurePretestClipsForUser } = require('../services/onboarding');
        const pretestClips = await ensurePretestClipsForUser(req.user._id);
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
        return res.status(403).json({ message: 'This clip is not in your assigned pre-test set' });
      }

      await LabelSubmission.findOneAndUpdate(
        { assignmentId: assignment._id, userId: req.user._id },
        { assignmentId: assignment._id, userId: req.user._id, events: [], status: 'draft' },
        { upsert: true, new: true }
      );

      return res.json({
        ...assignment.toObject(),
        assignedTo: req.user._id,
        status: 'assigned',
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

    await LabelSubmission.findOneAndUpdate(
      { assignmentId: assignment._id, userId: req.user._id },
      { assignmentId: assignment._id, userId: req.user._id, events: [], status: 'draft' },
      { upsert: true, new: true }
    );

    return res.json(assignment);
  } catch (error) {
    return res.status(400).json({ message: error.message });
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

    const submission = await LabelSubmission.findOne(filter).populate('userId', 'name email');
    if (!submission) {
      return res.json({ events: [], status: 'draft' });
    }
    return res.json(submission);
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

    const submission = await LabelSubmission.findOneAndUpdate(
      { assignmentId: req.params.id, userId: req.user._id },
      {
        events: events || [],
        status: status || 'draft',
      },
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
          grading.user = {
            bestLabelingTestScore: user.bestLabelingTestScore,
            labelingTestPassed: user.labelingTestPassed,
            canAccessProduction: canAccessProduction(user),
          };
        } else if (assignment.kind === 'production' || !assignment.kind) {
          grading.suggestedReviewPoints = scoreResult.totalScore;
        }
      } catch (gradeError) {
        grading = { error: gradeError.message };
      }
    } else if (assignment.kind !== 'tutorial' && assignment.status === 'assigned') {
      await patchAssignment(assignment._id, { status: 'in_progress' });
    }

    return res.json({ submission, grading });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

module.exports = router;
