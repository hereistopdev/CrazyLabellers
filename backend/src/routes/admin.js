const express = require('express');
const User = require('../models/User');
const TestResult = require('../models/TestResult');
const LabelSubmission = require('../models/LabelSubmission');
const VideoAssignment = require('../models/VideoAssignment');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/freelancers', auth, requireRole('admin'), async (_req, res) => {
  try {
    const freelancers = await User.find({ role: 'freelancer' })
      .select('-password')
      .sort({ createdAt: -1 });
    return res.json(freelancers);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch('/freelancers/:id/status', auth, requireRole('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'passed_test', 'approved', 'rejected'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json(user);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/stats', auth, requireRole('admin'), async (_req, res) => {
  try {
    const [freelancerCount, passedTestCount, assignmentCount, submissionCount] =
      await Promise.all([
        User.countDocuments({ role: 'freelancer' }),
        User.countDocuments({ role: 'freelancer', status: { $in: ['passed_test', 'approved'] } }),
        VideoAssignment.countDocuments(),
        LabelSubmission.countDocuments({ status: 'submitted' }),
      ]);

    return res.json({
      freelancerCount,
      passedTestCount,
      assignmentCount,
      submissionCount,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/submissions', auth, requireRole('admin'), async (_req, res) => {
  try {
    const submissions = await LabelSubmission.find({ status: 'submitted' })
      .populate('userId', 'name email')
      .populate('assignmentId', 'title videoUrl')
      .sort({ updatedAt: -1 });
    return res.json(submissions);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch('/submissions/:id/review', auth, requireRole('admin'), async (req, res) => {
  try {
    const { status, reviewerNotes } = req.body;
    const submission = await LabelSubmission.findByIdAndUpdate(
      req.params.id,
      { status, reviewerNotes },
      { new: true }
    );

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    if (submission.assignmentId) {
      await VideoAssignment.findByIdAndUpdate(submission.assignmentId, {
        status: status === 'approved' ? 'approved' : 'rejected',
      });
    }

    return res.json(submission);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

module.exports = router;
