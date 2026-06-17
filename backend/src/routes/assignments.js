const express = require('express');
const VideoAssignment = require('../models/VideoAssignment');
const LabelSubmission = require('../models/LabelSubmission');
const { auth, requireRole } = require('../middleware/auth');
const { isLabeller } = require('../config/roles');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    let filter = {};
    if (isLabeller(req.user)) {
      if (req.user.status !== 'passed_test' && req.user.status !== 'approved') {
        return res.status(403).json({
          message: 'You must pass the knowledge test before accessing labeling assignments',
        });
      }
      filter = {
        $or: [{ assignedTo: req.user._id }, { status: 'available' }],
      };
    }

    const assignments = await VideoAssignment.find(filter)
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });
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
    if (req.user.status !== 'passed_test' && req.user.status !== 'approved') {
      return res.status(403).json({ message: 'Pass the knowledge test first' });
    }

    const assignment = await VideoAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    if (assignment.status !== 'available') {
      return res.status(400).json({ message: 'Assignment is not available' });
    }

    assignment.assignedTo = req.user._id;
    assignment.status = 'assigned';
    await assignment.save();

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
      assignment.assignedTo?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'You are not assigned to this video' });
    }

    const submission = await LabelSubmission.findOneAndUpdate(
      { assignmentId: req.params.id, userId: req.user._id },
      {
        events: events || [],
        status: status || 'draft',
      },
      { upsert: true, new: true, runValidators: true }
    );

    if (status === 'submitted') {
      assignment.status = 'submitted';
      await assignment.save();
    } else if (assignment.status === 'assigned') {
      assignment.status = 'in_progress';
      await assignment.save();
    }

    return res.json(submission);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

module.exports = router;
