const express = require('express');
const { auth } = require('../middleware/auth');
const { isLabeller } = require('../config/roles');
const VideoAssignment = require('../models/VideoAssignment');
const LabelSubmission = require('../models/LabelSubmission');
const {
  getTutorialProgress,
  canAccessTutorial,
  refreshTutorialCompletion,
} = require('../services/tutorialProgress');

const router = express.Router();

router.get('/status', auth, async (req, res) => {
  try {
    if (!isLabeller(req.user)) {
      return res.status(403).json({ message: 'Labellers only' });
    }

    const progress = await getTutorialProgress(req.user._id);
    return res.json({
      canAccess: canAccessTutorial(req.user),
      tutorialsCompleted: req.user.tutorialsCompleted || progress.allCompleted,
      ...progress,
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
    if (!canAccessTutorial(req.user)) {
      return res.status(403).json({ message: 'Pass the knowledge test first' });
    }

    // Tutorials are shared — always keep them open for every labeller.
    await VideoAssignment.updateMany(
      { kind: 'tutorial' },
      { $set: { status: 'available', assignedTo: null, taskPrice: 0 } }
    );

    const assignments = await VideoAssignment.find({ kind: 'tutorial' })
      .populate('assignedTo', 'name email')
      .sort({ sortOrder: 1, createdAt: 1 });

    const progress = await getTutorialProgress(req.user._id);
    const completedSet = new Set(
      progress.tutorials.filter((t) => t.completed).map((t) => String(t.id))
    );

    return res.json(
      assignments.map((a) => ({
        ...a.toObject(),
        tutorialCompleted: completedSet.has(String(a._id)),
      }))
    );
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/assignments/:id', auth, async (req, res) => {
  try {
    if (!isLabeller(req.user)) {
      return res.status(403).json({ message: 'Labellers only' });
    }
    if (!canAccessTutorial(req.user)) {
      return res.status(403).json({ message: 'Pass the knowledge test first' });
    }

    const assignment = await VideoAssignment.findById(req.params.id);
    if (!assignment || assignment.kind !== 'tutorial') {
      return res.status(404).json({ message: 'Tutorial not found' });
    }

    return res.json(assignment);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/assignments/:id/complete', auth, async (req, res) => {
  try {
    if (!isLabeller(req.user)) {
      return res.status(403).json({ message: 'Labellers only' });
    }
    if (!canAccessTutorial(req.user)) {
      return res.status(403).json({ message: 'Pass the knowledge test first' });
    }

    const assignment = await VideoAssignment.findById(req.params.id);
    if (!assignment || assignment.kind !== 'tutorial') {
      return res.status(404).json({ message: 'Tutorial not found' });
    }

    await LabelSubmission.findOneAndUpdate(
      { assignmentId: assignment._id, userId: req.user._id },
      {
        assignmentId: assignment._id,
        userId: req.user._id,
        events: [],
        status: 'approved',
      },
      { upsert: true, new: true }
    );

    const { user, progress } = await refreshTutorialCompletion(req.user._id);
    return res.json({
      completed: true,
      tutorialsCompleted: user.tutorialsCompleted,
      progress,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

module.exports = router;
