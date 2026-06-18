const express = require('express');
const { auth } = require('../middleware/auth');
const { isLabeller } = require('../config/roles');
const VideoAssignment = require('../models/VideoAssignment');
const {
  getTutorialProgress,
  canAccessTutorial,
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

    // Tutorials should always be re-playable; unlock any stuck non-active states.
    await VideoAssignment.updateMany(
      { kind: 'tutorial', status: { $in: ['submitted', 'approved', 'rejected'] } },
      { $set: { status: 'available', assignedTo: null } }
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

module.exports = router;
