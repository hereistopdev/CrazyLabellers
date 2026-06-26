const express = require('express');
const multer = require('multer');
const ImageAssignment = require('../models/ImageAssignment');
const ImageKeypointSubmission = require('../models/ImageKeypointSubmission');
const TaskGroup = require('../models/TaskGroup');
const { auth, requireVideoManagerAccess } = require('../middleware/auth');
const { resolveUploadGroupId } = require('../services/taskGroups');
const {
  storeImageFile,
  deleteImageFile,
  resolveImageId,
  getImageExtension,
} = require('../services/imageStorage');
const { validateTaskPrice } = require('../config/payments');

const router = express.Router();

const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 100 },
}).array('images', 100);

router.get('/', auth, requireVideoManagerAccess, async (_req, res) => {
  try {
    const assignments = await ImageAssignment.find()
      .populate('groupId', 'name')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });
    return res.json(assignments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/upload', auth, requireVideoManagerAccess, (req, res) => {
  uploadImages(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Upload failed' });
    }

    try {
      const files = req.files || [];
      if (!files.length) {
        return res.status(400).json({ message: 'Select at least one image file' });
      }

      const groupId = await resolveUploadGroupId({
        groupId: req.body.groupId,
        newGroupName: req.body.newGroupName,
        kind: 'production',
      });

      const taskPrice =
        req.body.taskPrice != null ? validateTaskPrice(req.body.taskPrice, { kind: 'production' }) : 0.5;

      const created = [];
      const skipped = [];

      for (const file of files) {
        const imageId = resolveImageId(file.originalname, req.body.imageIdPrefix);
        if (!imageId) {
          skipped.push({ name: file.originalname, reason: 'Invalid image ID from filename' });
          continue;
        }

        const existing = await ImageAssignment.findOne({ imageId });
        if (existing) {
          skipped.push({ name: file.originalname, reason: 'Image ID already exists' });
          continue;
        }

        const extension = getImageExtension(file.originalname);
        const stored = storeImageFile(imageId, file.buffer, extension);

        const assignment = await ImageAssignment.create({
          imageId,
          title: imageId,
          description: req.body.description || 'Cricket keypoint labeling',
          imageUrl: stored.imageUrl,
          imageExtension: stored.extension,
          groupId,
          taskPrice,
          status: 'available',
          uploadedBy: req.user._id,
        });

        created.push(assignment);
      }

      return res.status(201).json({
        created: created.length,
        skipped: skipped.length,
        items: created,
        skippedItems: skipped,
      });
    } catch (error) {
      return res.status(error.status || 400).json({ message: error.message });
    }
  });
});

router.delete('/:id', auth, requireVideoManagerAccess, async (req, res) => {
  try {
    const assignment = await ImageAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Image assignment not found' });
    }

    await ImageKeypointSubmission.deleteMany({ assignmentId: assignment._id });
    deleteImageFile(assignment.imageId);
    await ImageAssignment.findByIdAndDelete(assignment._id);

    return res.json({ message: 'Image assignment deleted' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/groups/summary', auth, requireVideoManagerAccess, async (_req, res) => {
  try {
    const groups = await TaskGroup.find().sort({ sortOrder: 1, name: 1 });
    const counts = await ImageAssignment.aggregate([
      { $match: { groupId: { $exists: true, $ne: null } } },
      { $group: { _id: '$groupId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((row) => [String(row._id), row.count]));

    return res.json(
      groups.map((group) => ({
        ...group.toObject(),
        imageCount: countMap.get(String(group._id)) || 0,
      }))
    );
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
