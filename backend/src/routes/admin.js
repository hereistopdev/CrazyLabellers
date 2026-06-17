const express = require('express');
const User = require('../models/User');
const TestResult = require('../models/TestResult');
const LabelSubmission = require('../models/LabelSubmission');
const VideoAssignment = require('../models/VideoAssignment');
const { auth, requireRole } = require('../middleware/auth');
const { LABELLER_ROLES } = require('../config/roles');

const router = express.Router();

router.post('/labellers', auth, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, status } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const allowedStatuses = ['pending', 'passed_test', 'approved', 'rejected'];
    const labellerStatus = allowedStatuses.includes(status) ? status : 'pending';

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const labeller = await User.create({
      name,
      email,
      password,
      role: 'labeller',
      status: labellerStatus,
    });

    return res.status(201).json({
      id: labeller._id,
      name: labeller.name,
      email: labeller.email,
      role: labeller.role,
      status: labeller.status,
      bestTestScore: labeller.bestTestScore,
      testAttempts: labeller.testAttempts,
      createdAt: labeller.createdAt,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/labellers', auth, requireRole('admin'), async (req, res) => {
  try {
    const filter = { role: { $in: LABELLER_ROLES } };
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const labellers = await User.find(filter).select('-password').sort({ createdAt: -1 });
    return res.json(labellers);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/labellers/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const labeller = await User.findOne({
      _id: req.params.id,
      role: { $in: LABELLER_ROLES },
    }).select('-password');

    if (!labeller) {
      return res.status(404).json({ message: 'Labeller not found' });
    }

    const [testResults, submissions, assignmentsClaimed] = await Promise.all([
      TestResult.find({ userId: labeller._id }).sort({ createdAt: -1 }).limit(10),
      LabelSubmission.find({ userId: labeller._id })
        .populate('assignmentId', 'title status')
        .sort({ updatedAt: -1 })
        .limit(20),
      VideoAssignment.countDocuments({ assignedTo: labeller._id }),
    ]);

    return res.json({
      labeller,
      testResults,
      submissions,
      assignmentsClaimed,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch('/labellers/:id/status', auth, requireRole('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'passed_test', 'approved', 'rejected'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: { $in: LABELLER_ROLES } },
      { status },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'Labeller not found' });
    }
    return res.json(user);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.delete('/labellers/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const labeller = await User.findOne({
      _id: req.params.id,
      role: { $in: LABELLER_ROLES },
    });

    if (!labeller) {
      return res.status(404).json({ message: 'Labeller not found' });
    }

    await Promise.all([
      LabelSubmission.deleteMany({ userId: labeller._id }),
      TestResult.deleteMany({ userId: labeller._id }),
      VideoAssignment.updateMany(
        { assignedTo: labeller._id },
        { $set: { assignedTo: null, status: 'available' } }
      ),
    ]);

    await User.findByIdAndDelete(labeller._id);

    return res.json({ message: 'Labeller removed successfully' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.post('/labellers/:id/assign', auth, requireRole('admin'), async (req, res) => {
  try {
    const { assignmentId } = req.body;
    const labeller = await User.findOne({
      _id: req.params.id,
      role: { $in: LABELLER_ROLES },
      status: { $in: ['passed_test', 'approved'] },
    });

    if (!labeller) {
      return res.status(404).json({ message: 'Labeller not found or not eligible' });
    }

    const assignment = await VideoAssignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    assignment.assignedTo = labeller._id;
    assignment.status = 'assigned';
    await assignment.save();

    await LabelSubmission.findOneAndUpdate(
      { assignmentId: assignment._id, userId: labeller._id },
      { assignmentId: assignment._id, userId: labeller._id, events: [], status: 'draft' },
      { upsert: true, new: true }
    );

    return res.json(assignment);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/stats', auth, requireRole('admin'), async (_req, res) => {
  try {
    const [labellerCount, pendingCount, approvedCount, passedTestCount, assignmentCount, submissionCount] =
      await Promise.all([
        User.countDocuments({ role: { $in: LABELLER_ROLES } }),
        User.countDocuments({ role: { $in: LABELLER_ROLES }, status: 'pending' }),
        User.countDocuments({ role: { $in: LABELLER_ROLES }, status: 'approved' }),
        User.countDocuments({ role: { $in: LABELLER_ROLES }, status: { $in: ['passed_test', 'approved'] } }),
        VideoAssignment.countDocuments(),
        LabelSubmission.countDocuments({ status: 'submitted' }),
      ]);

    return res.json({
      labellerCount,
      pendingCount,
      approvedCount,
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
      .populate('userId', 'name email status')
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

router.get('/assignments', auth, requireRole('admin'), async (_req, res) => {
  try {
    const assignments = await VideoAssignment.find()
      .populate('assignedTo', 'name email status')
      .sort({ createdAt: -1 });
    return res.json(assignments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
