const express = require('express');
const LabelSubmission = require('../models/LabelSubmission');
const LabelingTestResult = require('../models/LabelingTestResult');
const VideoAssignment = require('../models/VideoAssignment');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { isLabeller } = require('../config/roles');
const {
  canAccessPretest,
  getPretestClipsWithProgress,
  getOnboardingStatus,
  isPretestClipForUser,
  PRETEST_CLIPS_PER_LABELLER,
} = require('../services/onboarding');
const { PASS_THRESHOLD } = require('../utils/labelingScore');
const { buildScoreReviewPayload } = require('../services/scoreReview');

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
      clipsPassed: onboarding.steps.labelingTest.clipsPassed,
      clipsRequired: onboarding.steps.labelingTest.clipsRequired,
      clipsSubmitted: onboarding.steps.labelingTest.clipsSubmitted,
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

    const assignments = await getPretestClipsWithProgress(req.user._id);
    return res.json(assignments);
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

router.get('/assignments/:assignmentId/score-review', auth, async (req, res) => {
  try {
    if (!isLabeller(req.user)) {
      return res.status(403).json({ message: 'Labellers only' });
    }
    if (!canAccessPretest(req.user)) {
      return res.status(403).json({ message: 'Complete tutorials before viewing pre-test results' });
    }

    const user = await User.findById(req.user._id);
    const assignment = await VideoAssignment.findById(req.params.assignmentId);
    if (!assignment || assignment.kind !== 'pretest') {
      return res.status(404).json({ message: 'Pre-test clip not found' });
    }
    if (!isPretestClipForUser(user, assignment._id)) {
      return res.status(403).json({ message: 'This clip is not in your pre-test set' });
    }

    const submission = await LabelSubmission.findOne({
      userId: req.user._id,
      assignmentId: assignment._id,
      status: 'submitted',
    });
    if (!submission) {
      return res.status(404).json({ message: 'No submitted pre-test found for this clip' });
    }
    if (submission.pretestScoreReviewSeenAt) {
      return res.status(403).json({
        message:
          'Score review already viewed for this clip. Continue with your other pre-test clips.',
        code: 'PRETEST_REVIEW_SEEN',
      });
    }

    const payload = await buildScoreReviewPayload(submission, assignment);
    return res.json({
      ...payload,
      passThreshold: PASS_THRESHOLD,
      oneTimeReview: true,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/assignments/:assignmentId/score-review/acknowledge', auth, async (req, res) => {
  try {
    if (!isLabeller(req.user)) {
      return res.status(403).json({ message: 'Labellers only' });
    }

    const user = await User.findById(req.user._id);
    const assignment = await VideoAssignment.findById(req.params.assignmentId);
    if (!assignment || assignment.kind !== 'pretest') {
      return res.status(404).json({ message: 'Pre-test clip not found' });
    }
    if (!isPretestClipForUser(user, assignment._id)) {
      return res.status(403).json({ message: 'This clip is not in your pre-test set' });
    }

    const submission = await LabelSubmission.findOneAndUpdate(
      {
        userId: req.user._id,
        assignmentId: assignment._id,
        status: 'submitted',
      },
      { $set: { pretestScoreReviewSeenAt: new Date() } },
      { new: true }
    );
    if (!submission) {
      return res.status(404).json({ message: 'No submitted pre-test found' });
    }

    return res.json({ acknowledged: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
