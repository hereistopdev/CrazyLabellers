const express = require('express');
const multer = require('multer');
const ImageAssignment = require('../models/ImageAssignment');
const ImageKeypointSubmission = require('../models/ImageKeypointSubmission');
const TaskGroup = require('../models/TaskGroup');
const { auth, requireVideoManagerAccess } = require('../middleware/auth');
const { resolveUploadGroupId } = require('../services/taskGroups');
const {
  storeImageFile,
  resolveImageId,
  getImageExtension,
  normalizeImageUrl,
  isRemoteImageStorage,
} = require('../services/imageStorage');
const {
  saveReferenceForImage,
  deleteReferenceForImage,
  hasReferenceForImage,
} = require('../services/imageReferenceStorage');
const { reseedEligibleSubmissionsFromReference } = require('../services/imageReferenceDraftSeed');
const { deleteImageAssignmentRecord, deleteImageAssignmentsByFilter } = require('../services/imageAssignmentDelete');
const { validateTaskPrice } = require('../config/payments');
const path = require('path');

const router = express.Router();

const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 500 },
}).fields([
  { name: 'images', maxCount: 250 },
  { name: 'references', maxCount: 250 },
]);

router.get('/', auth, requireVideoManagerAccess, async (_req, res) => {
  try {
    const assignments = await ImageAssignment.find()
      .populate('groupId', 'name')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });
    return res.json(
      assignments.map((assignment) => ({
        ...assignment.toObject(),
        imageUrl: normalizeImageUrl(assignment.imageUrl),
      }))
    );
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
      const imageFiles = req.files?.images || [];
      const referenceFiles = req.files?.references || [];
      if (!imageFiles.length) {
        return res.status(400).json({ message: 'Select at least one image file' });
      }

      const refsByStem = new Map();
      for (const file of referenceFiles) {
        const baseName = path.basename(file.originalname);
        const stem = path.basename(baseName, path.extname(baseName));
        refsByStem.set(stem, file);
      }

      const groupId = await resolveUploadGroupId({
        groupId: req.body.groupId,
        newGroupName: req.body.newGroupName,
        kind: 'production',
      });

      const taskPrice =
        req.body.taskPrice != null ? validateTaskPrice(req.body.taskPrice, { kind: 'production' }) : 0.5;

      const shareReference = req.body.allowLabellerReference === 'true' || req.body.allowLabellerReference === true;
      const created = [];
      const skipped = [];

      for (const file of imageFiles) {
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
        const stored = await storeImageFile(imageId, file.buffer, extension);

        let hasReference = false;
        let width = null;
        let height = null;
        const refFile = refsByStem.get(imageId) || refsByStem.get(path.basename(file.originalname, extension));
        if (refFile) {
          try {
            const savedRef = await saveReferenceForImage(imageId, refFile.buffer.toString('utf8'), {
              sourceFilename: refFile.originalname,
            });
            hasReference = true;
            width = savedRef.width;
            height = savedRef.height;
          } catch (refErr) {
            skipped.push({
              name: file.originalname,
              reason: `Image saved but reference JSON failed: ${refErr.message}`,
            });
          }
        }

        const assignment = await ImageAssignment.create({
          imageId,
          title: imageId,
          description: req.body.description || 'Cricket keypoint labeling',
          imageUrl: stored.imageUrl,
          imageExtension: stored.extension,
          width,
          height,
          groupId,
          taskPrice,
          status: 'available',
          uploadedBy: req.user._id,
          hasReference,
          allowLabellerReference: shareReference && hasReference,
          referenceUpdatedAt: hasReference ? new Date() : undefined,
          referenceUpdatedBy: hasReference ? req.user._id : undefined,
        });

        created.push(assignment);
      }

      return res.status(201).json({
        created: created.length,
        skipped: skipped.length,
        matchedReferences: created.filter((row) => row.hasReference).length,
        storage: isRemoteImageStorage() ? 'vps' : 'local',
        items: created,
        skippedItems: skipped,
      });
    } catch (error) {
      return res.status(error.status || 400).json({ message: error.message });
    }
  });
});

router.post('/bulk-delete', auth, requireVideoManagerAccess, async (req, res) => {
  try {
    const { assignmentIds, groupId } = req.body || {};
    let filter = null;

    if (Array.isArray(assignmentIds) && assignmentIds.length > 0) {
      filter = { _id: { $in: assignmentIds } };
    } else if (groupId === 'ungrouped') {
      filter = { groupId: null };
    } else if (groupId) {
      filter = { groupId };
    } else {
      return res.status(400).json({ message: 'Provide assignmentIds or groupId to delete' });
    }

    const deleted = await deleteImageAssignmentsByFilter(filter);
    if (deleted === 0) {
      return res.status(404).json({ message: 'No matching images to delete' });
    }

    return res.json({
      message: `Deleted ${deleted} image${deleted === 1 ? '' : 's'}`,
      deleted,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', auth, requireVideoManagerAccess, async (req, res) => {
  try {
    const assignment = await ImageAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Image assignment not found' });
    }

    await deleteImageAssignmentRecord(assignment);

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

router.patch('/assignments/:id/reference-share', auth, requireVideoManagerAccess, async (req, res) => {
  try {
    const assignment = await ImageAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Image assignment not found' });
    }

    const enabled = Boolean(req.body.allowLabellerReference);
    if (enabled && !assignment.hasReference && !hasReferenceForImage(assignment.imageId)) {
      return res.status(400).json({ message: 'Upload a reference JSON for this image first' });
    }

    assignment.allowLabellerReference = enabled;
    if (enabled && !assignment.hasReference) {
      assignment.hasReference = true;
    }
    await assignment.save();

    let reseeded = 0;
    if (enabled) {
      reseeded = await reseedEligibleSubmissionsFromReference(assignment);
    }

    return res.json({
      message: enabled
        ? reseeded > 0
          ? `Reference shared with labellers (${reseeded} draft${reseeded === 1 ? '' : 's'} seeded)`
          : 'Reference shared with labellers'
        : 'Reference hidden from labellers',
      allowLabellerReference: assignment.allowLabellerReference,
      reseeded,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.post(
  '/assignments/:id/reference',
  auth,
  requireVideoManagerAccess,
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  }).single('reference'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No reference JSON file uploaded' });
      }

      const assignment = await ImageAssignment.findById(req.params.id);
      if (!assignment) {
        return res.status(404).json({ message: 'Image assignment not found' });
      }

      const savedRef = await saveReferenceForImage(
        assignment.imageId,
        req.file.buffer.toString('utf8'),
        { sourceFilename: req.file.originalname }
      );

      assignment.hasReference = true;
      assignment.width = savedRef.width || assignment.width;
      assignment.height = savedRef.height || assignment.height;
      assignment.referenceUpdatedAt = new Date();
      assignment.referenceUpdatedBy = req.user._id;
      await assignment.save();

      const reseeded = assignment.allowLabellerReference
        ? await reseedEligibleSubmissionsFromReference(assignment)
        : 0;

      return res.json({
        message:
          reseeded > 0
            ? `Reference JSON saved and ${reseeded} labeller draft${reseeded === 1 ? '' : 's'} seeded`
            : 'Reference JSON saved',
        hasReference: true,
        keypointCount: savedRef.keypoints.length,
        reseeded,
      });
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }
);

router.patch('/assignments/:id/review', auth, requireVideoManagerAccess, async (req, res) => {
  try {
    const { status, reviewerNotes } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    const assignment = await ImageAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Image assignment not found' });
    }

    const submission = await ImageKeypointSubmission.findOne({
      assignmentId: assignment._id,
      userId: assignment.assignedTo,
    }).sort({ updatedAt: -1 });

    if (!submission) {
      return res.status(404).json({ message: 'No submission found for this image' });
    }

    if (submission.status !== 'submitted' && submission.status !== 'approved') {
      return res.status(400).json({ message: 'Can only review submitted work' });
    }

    submission.status = status;
    submission.reviewerNotes = reviewerNotes || '';
    submission.reviewedAt = new Date();
    submission.reviewedBy = req.user._id;
    if (status === 'approved') {
      submission.reviewPoints = Math.min(100, Math.max(0, parseInt(req.body.reviewPoints, 10) || 0));
    } else {
      submission.reviewPoints = 0;
    }
    await submission.save();

    assignment.status = status;
    assignment.reviewedAt = new Date();
    assignment.reviewedBy = req.user._id;
    await assignment.save();

    return res.json({
      message: status === 'approved' ? 'Image submission approved' : 'Image submission rejected',
      assignmentId: assignment._id,
      status,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

module.exports = router;
