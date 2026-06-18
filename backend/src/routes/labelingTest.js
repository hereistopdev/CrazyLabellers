const express = require('express');
const VideoAssignment = require('../models/VideoAssignment');
const LabelSubmission = require('../models/LabelSubmission');
const LabelingTestResult = require('../models/LabelingTestResult');
const { auth } = require('../middleware/auth');
const { isLabeller } = require('../config/roles');
const {
  canAccessPretest,
  canAccessProduction,
  PASS_THRESHOLD,
} = require('../services/grading');
const { setupPretestClips } = require('../services/pretestSetup');

const router = express.Router();

router.get('/status', auth, async (req, res) => {
  try {
    if (!isLabeller(req.user)) {
      return res.status(403).json({ message: 'Labellers only' });
    }

    const latest = await LabelingTestResult.findOne({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('assignmentId', 'title clipId');

    return res.json({
      passThreshold: PASS_THRESHOLD,
      pretestCount: 3,
      bestScore: req.user.bestLabelingTestScore || 0,
      attempts: req.user.labelingTestAttempts || 0,
      passed: Boolean(req.user.labelingTestPassed || req.user.bestLabelingTestScore >= PASS_THRESHOLD),
      tutorialsCompleted: Boolean(req.user.tutorialsCompleted),
      canAccessPretest: canAccessPretest(req.user),
      canAccessProduction: canAccessProduction(req.user),
      latestResult: latest,
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
      const msg =
        req.user.status !== 'passed_test' && req.user.status !== 'approved'
          ? 'Pass the knowledge test (80%+) before taking the labeling test'
          : 'Complete all tutorial tasks before the labeling pre-test';
      return res.status(403).json({ message: msg });
    }

    const assignments = await VideoAssignment.find({
      kind: 'pretest',
      $or: [{ assignedTo: req.user._id }, { status: 'available' }],
    })
      .populate('assignedTo', 'name email')
      .sort({ createdAt: 1 });

    return res.json(assignments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
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

router.post('/setup-clips', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }
    const result = await setupPretestClips({
      pretestCount: parseInt(req.body.pretestCount, 10) || undefined,
    });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

module.exports = router;
