const express = require('express');
const LabelSubmission = require('../models/LabelSubmission');
const LabelingTestResult = require('../models/LabelingTestResult');
const { auth } = require('../middleware/auth');
const { isLabeller } = require('../config/roles');
const {
  canAccessPretest,
  canAccessProduction,
  ensurePretestClipsForUser,
  getOnboardingStatus,
  PRETEST_CLIPS_PER_LABELLER,
} = require('../services/onboarding');
const { PASS_THRESHOLD } = require('../utils/labelingScore');

const router = express.Router();

router.get('/status', auth, async (req, res) => {
  try {
    if (!isLabeller(req.user)) {
      return res.status(403).json({ message: 'Labellers only' });
    }

    const [onboarding, latest] = await Promise.all([
      getOnboardingStatus(req.user._id),
      LabelingTestResult.findOne({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .populate('assignmentId', 'title clipId'),
    ]);

    return res.json({
      passThreshold: PASS_THRESHOLD,
      pretestCount: PRETEST_CLIPS_PER_LABELLER,
      bestScore: req.user.bestLabelingTestScore || 0,
      attempts: req.user.labelingTestAttempts || 0,
      passed: onboarding.steps.labelingTest.passed,
      tutorialsCompleted: onboarding.steps.tutorials.passed,
      canAccessPretest: onboarding.canAccessPretest,
      canAccessProduction: onboarding.canAccessProduction,
      pretestPool: onboarding.pretestPool,
      clipsAssigned: onboarding.steps.labelingTest.clipsAssigned,
      latestResult: latest,
      onboarding: onboarding.steps,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/assignments', auth, async (req, res) => {
  try {
    if (!isLabeller(req.user)) {
      return res.status(403).json({ message: 'Labellers only' });
    }
    if (!canAccessPretest(req.user)) {
      const msg = !canAccessPretest(req.user)
        ? 'Complete the knowledge test and tutorials before the video pre-test'
        : 'Complete all tutorial tasks before the labeling pre-test';
      return res.status(403).json({ message: msg });
    }

    const assignments = await ensurePretestClipsForUser(req.user._id);

    const submissions = await LabelSubmission.find({
      userId: req.user._id,
      assignmentId: { $in: assignments.map((a) => a._id) },
    }).select('assignmentId autoScore status updatedAt events');

    const submissionByAssignment = new Map(
      submissions.map((s) => [String(s.assignmentId), s])
    );

    return res.json(
      assignments.map((a) => {
        const submission = submissionByAssignment.get(String(a._id));
        const hasDraft = submission && submission.status === 'draft';
        const hasSubmitted = submission && submission.status === 'submitted';
        return {
          ...a.toObject(),
          taskPrice: 0,
          assignedTo: req.user._id,
          status: hasSubmitted ? 'submitted' : hasDraft ? 'in_progress' : 'available',
          lastScore: submission?.autoScore ?? null,
          lastSubmittedAt: hasSubmitted ? submission.updatedAt : null,
        };
      })
    );
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.get('/results', auth, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    const results = await LabelingTestResult.find(filter)
      .populate('assignmentId', 'title clipId')
      .sort({ createdAt: -1 })
      .limit(20);
    return res.json(results);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
