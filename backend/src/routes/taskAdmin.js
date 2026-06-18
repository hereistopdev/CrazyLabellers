const express = require('express');
const VideoAssignment = require('../models/VideoAssignment');
const TaskGroup = require('../models/TaskGroup');
const LabelSubmission = require('../models/LabelSubmission');
const { auth, requireRole } = require('../middleware/auth');
const { validateTaskPrice } = require('../config/payments');
const { hasReferenceForClip } = require('../services/referenceStorage');

const router = express.Router();

router.get('/groups', auth, requireRole('admin'), async (_req, res) => {
  try {
    const groups = await TaskGroup.find().sort({ sortOrder: 1, name: 1 });
    const counts = await VideoAssignment.aggregate([
      { $match: { kind: 'production', groupId: { $exists: true, $ne: null } } },
      { $group: { _id: '$groupId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

    return res.json(
      groups.map((g) => ({
        ...g.toObject(),
        taskCount: countMap.get(String(g._id)) || 0,
      }))
    );
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/groups', auth, requireRole('admin'), async (req, res) => {
  try {
    const { name, description, sortOrder, active } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: 'Group name is required' });
    }
    const group = await TaskGroup.create({
      name: name.trim(),
      description: description || '',
      sortOrder: parseInt(sortOrder, 10) || 0,
      active: active !== false,
    });
    return res.status(201).json(group);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.patch('/groups/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { name, description, sortOrder, active } = req.body;
    const update = {};
    if (name !== undefined) update.name = String(name).trim();
    if (description !== undefined) update.description = String(description);
    if (sortOrder !== undefined) update.sortOrder = parseInt(sortOrder, 10) || 0;
    if (active !== undefined) update.active = Boolean(active);

    const group = await TaskGroup.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!group) return res.status(404).json({ message: 'Group not found' });
    return res.json(group);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.delete('/groups/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await VideoAssignment.updateMany({ groupId: req.params.id }, { $unset: { groupId: 1 } });
    const group = await TaskGroup.findByIdAndDelete(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    return res.json({ message: 'Group deleted' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.kind) filter.kind = req.query.kind;
    if (req.query.groupId) filter.groupId = req.query.groupId;

    const tasks = await VideoAssignment.find(filter)
      .populate('assignedTo', 'name email')
      .populate('groupId', 'name')
      .sort({ kind: 1, sortOrder: 1, createdAt: -1 });

    const enriched = await Promise.all(
      tasks.map(async (task) => ({
        ...task.toObject(),
        hasReference: task.clipId ? await hasReferenceForClip(task.clipId) : false,
        submissionCount: await LabelSubmission.countDocuments({ assignmentId: task._id }),
      }))
    );

    return res.json(enriched);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const {
      title,
      description,
      kind,
      sortOrder,
      groupId,
      taskPrice,
      challengeNote,
      gameTime,
      durationSeconds,
      tutorialIntro,
      tutorialSteps,
      status,
    } = req.body;

    const update = {};
    if (title !== undefined) update.title = String(title).trim();
    if (description !== undefined) update.description = String(description);
    if (kind !== undefined) {
      if (!['tutorial', 'pretest', 'production'].includes(kind)) {
        return res.status(400).json({ message: 'Invalid task kind' });
      }
      update.kind = kind;
    }
    if (sortOrder !== undefined) update.sortOrder = parseInt(sortOrder, 10) || 0;
    if (groupId !== undefined) update.groupId = groupId || null;
    if (taskPrice !== undefined) update.taskPrice = validateTaskPrice(taskPrice);
    if (challengeNote !== undefined) update.challengeNote = String(challengeNote);
    if (gameTime !== undefined) update.gameTime = String(gameTime);
    if (durationSeconds !== undefined) update.durationSeconds = parseInt(durationSeconds, 10) || 30;
    if (tutorialIntro !== undefined) update.tutorialIntro = String(tutorialIntro);
    if (tutorialSteps !== undefined) update.tutorialSteps = tutorialSteps;
    if (status !== undefined) update.status = status;

    const task = await VideoAssignment.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('groupId', 'name')
      .populate('assignedTo', 'name email');

    if (!task) return res.status(404).json({ message: 'Task not found' });
    return res.json(task);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

module.exports = router;
