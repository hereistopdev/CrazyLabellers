const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const User = require('../models/User');
const TestResult = require('../models/TestResult');
const LabelSubmission = require('../models/LabelSubmission');
const VideoAssignment = require('../models/VideoAssignment');
const { auth, requireRole } = require('../middleware/auth');
const { LABELLER_ROLES } = require('../config/roles');
const PaymentSettings = require('../models/PaymentSettings');
const { calculateTaskEarnings, DEFAULT_RATE_PER_POINT, clampReviewPoints, validateTaskPrice } = require('../config/payments');
const { upsertLabellerReview, getLabellerStats } = require('../services/labellerProfile');
const { exportAnnotation, getExportFilename } = require('../utils/exportAnnotation');
const { importClipsFromDir } = require('../services/clipImport');
const { isRemoteVideoStorage, storeVideoFile, getStorageStatus } = require('../services/videoStorage');
const { saveReferenceForClip, deleteReferenceForClip, hasReferenceForClip } = require('../services/referenceStorage');
const {
  ensureVideoDataDir,
  resolveClipId,
  createVideoAssignment,
  removeVideoAssignment,
} = require('../services/videoFiles');

const uploadVideoWithReference = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
}).fields([
  { name: 'video', maxCount: 1 },
  { name: 'reference', maxCount: 1 },
]);

const uploadReferenceOnly = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype === 'application/json' || file.originalname.toLowerCase().endsWith('.json')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only .json reference files are allowed'));
  },
});

const router = express.Router();

router.post('/checkers', auth, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const checker = await User.create({
      name,
      email,
      password,
      role: 'checker',
      status: 'approved',
    });

    return res.status(201).json({
      id: checker._id,
      name: checker.name,
      email: checker.email,
      role: checker.role,
      status: checker.status,
      createdAt: checker.createdAt,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/checkers', auth, requireRole('admin'), async (_req, res) => {
  try {
    const checkers = await User.find({ role: 'checker' }).select('-password').sort({ createdAt: -1 });
    return res.json(checkers);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

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

    const [testResults, submissions, assignmentsClaimed, profileStats] = await Promise.all([
      TestResult.find({ userId: labeller._id }).sort({ createdAt: -1 }).limit(10),
      LabelSubmission.find({ userId: labeller._id })
        .populate('assignmentId', 'title status taskPrice')
        .sort({ updatedAt: -1 })
        .limit(20),
      VideoAssignment.countDocuments({ assignedTo: labeller._id }),
      getLabellerStats(labeller._id),
    ]);

    return res.json({
      labeller: { ...labeller.toObject(), ...profileStats },
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
    const { status, reviewerNotes, reviewPoints, rating, reviewComment, aspects } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    let settings = await PaymentSettings.findOne();
    if (!settings) {
      settings = await PaymentSettings.create({ ratePerPoint: DEFAULT_RATE_PER_POINT });
    }

    const submissionDoc = await LabelSubmission.findById(req.params.id);
    if (!submissionDoc) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const assignment = await VideoAssignment.findById(submissionDoc.assignmentId);
    const points = status === 'approved' ? clampReviewPoints(parseInt(reviewPoints, 10) || 0) : 0;
    const earnings =
      status === 'approved'
        ? calculateTaskEarnings(points, assignment?.taskPrice, settings.ratePerPoint)
        : 0;

    const submission = await LabelSubmission.findByIdAndUpdate(
      req.params.id,
      {
        status,
        reviewerNotes: reviewerNotes || '',
        reviewPoints: status === 'approved' ? points : 0,
        earnings,
        reviewedAt: new Date(),
        reviewedBy: req.user._id,
      },
      { new: true }
    )
      .populate('userId', 'name email')
      .populate('reviewedBy', 'name email');

    if (submission.assignmentId) {
      await VideoAssignment.findByIdAndUpdate(submission.assignmentId, {
        status: status === 'approved' ? 'approved' : 'rejected',
      });
    }

    if (status === 'approved' && rating != null) {
      const starRating = Math.max(1, Math.min(5, parseInt(rating, 10) || 0));
      if (starRating >= 1) {
        await upsertLabellerReview({
          labellerId: submission.userId._id || submission.userId,
          submissionId: submission._id,
          reviewerId: req.user._id,
          rating: starRating,
          comment: reviewComment || reviewerNotes || '',
          aspects: aspects || undefined,
          assignmentTitle: assignment?.title || '',
          taskPrice: assignment?.taskPrice,
          reviewPoints: points,
          earnings,
        });
      }
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

    const enriched = await Promise.all(
      assignments.map(async (assignment) => ({
        ...assignment.toObject(),
        hasReference: assignment.clipId
          ? await hasReferenceForClip(assignment.clipId)
          : false,
      }))
    );

    return res.json(enriched);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch('/assignments/:id/price', auth, requireRole('admin'), async (req, res) => {
  try {
    const { taskPrice, challengeNote } = req.body;
    const update = {};

    if (taskPrice !== undefined) {
      update.taskPrice = validateTaskPrice(taskPrice);
    }
    if (challengeNote !== undefined) {
      update.challengeNote = String(challengeNote).trim();
    }

    const assignment = await VideoAssignment.findByIdAndUpdate(req.params.id, update, {
      new: true,
    }).populate('assignedTo', 'name email status');

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    return res.json(assignment);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.patch('/assignments/bulk-price', auth, requireRole('admin'), async (req, res) => {
  try {
    const { assignmentIds, taskPrice, challengeNote } = req.body;
    if (!Array.isArray(assignmentIds) || assignmentIds.length === 0) {
      return res.status(400).json({ message: 'assignmentIds array is required' });
    }

    const update = {};
    if (taskPrice !== undefined) {
      update.taskPrice = validateTaskPrice(taskPrice);
    }
    if (challengeNote !== undefined) {
      update.challengeNote = String(challengeNote).trim();
    }

    const result = await VideoAssignment.updateMany({ _id: { $in: assignmentIds } }, update);
    return res.json({ modified: result.modifiedCount, taskPrice: update.taskPrice });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/storage-status', auth, requireRole('admin'), async (_req, res) => {
  try {
    const status = await getStorageStatus();
    return res.json(status);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/videos', auth, requireRole('admin'), uploadVideoWithReference, async (req, res) => {
  try {
    const videoFile = req.files?.video?.[0];
    const referenceFile = req.files?.reference?.[0];

    if (!videoFile) {
      return res.status(400).json({ message: 'No video file uploaded' });
    }

    if (
      !videoFile.mimetype?.includes('mp4') &&
      !videoFile.originalname.toLowerCase().endsWith('.mp4')
    ) {
      return res.status(400).json({ message: 'Only .mp4 video files are allowed' });
    }

    const clipId = resolveClipId(videoFile.originalname);
    const durationSeconds = parseInt(req.body.durationSeconds, 10) || 30;
    const taskPrice = req.body.taskPrice != null ? validateTaskPrice(req.body.taskPrice) : undefined;

    await storeVideoFile(clipId, videoFile);

    const assignment = await createVideoAssignment({
      clipId,
      title: req.body.title?.trim() || clipId,
      description: req.body.description?.trim() || '',
      gameTime: req.body.gameTime?.trim() || '1 - 00:00',
      durationSeconds,
      taskPrice,
      challengeNote: req.body.challengeNote?.trim() || '',
    });

    let referenceSaved = false;
    if (referenceFile) {
      const rawJson = JSON.parse(referenceFile.buffer.toString('utf8'));
      await saveReferenceForClip(clipId, rawJson, {
        sourceFilename: referenceFile.originalname,
      });
      referenceSaved = true;
    }

    return res.status(201).json({
      ...assignment.toObject(),
      storage: isRemoteVideoStorage() ? 'vps' : 'local',
      hasReference: referenceSaved,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.post(
  '/assignments/:id/reference',
  auth,
  requireRole('admin'),
  uploadReferenceOnly.single('reference'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No reference JSON file uploaded' });
      }

      const assignment = await VideoAssignment.findById(req.params.id);
      if (!assignment?.clipId) {
        return res.status(404).json({ message: 'Assignment not found or has no clip ID' });
      }

      const rawJson = JSON.parse(req.file.buffer.toString('utf8'));
      const saved = await saveReferenceForClip(assignment.clipId, rawJson, {
        sourceFilename: req.file.originalname,
      });

      return res.json({
        message: 'Reference annotation saved',
        clipId: assignment.clipId,
        annotationCount: saved.annotationCount,
        hasReference: true,
      });
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }
);

router.delete('/videos/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const deleteFile = req.query.deleteFile !== 'false';
    const result = await removeVideoAssignment(req.params.id, { deleteFile });
    return res.json({
      message: 'Video removed',
      clipId: result.assignment.clipId,
      fileDeleted: result.fileDeleted,
    });
  } catch (error) {
    const status = error.message === 'Video not found' ? 404 : 400;
    return res.status(status).json({ message: error.message });
  }
});

router.post('/import-clips', auth, requireRole('admin'), async (_req, res) => {
  try {
    const result = await importClipsFromDir();
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/submissions/:id/export', auth, requireRole('admin'), async (req, res) => {
  try {
    const variant = req.query.variant === 'raw' ? 'raw' : 'post';
    const submission = await LabelSubmission.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const assignment = await VideoAssignment.findById(submission.assignmentId);
    if (!assignment?.clipId) {
      return res.status(400).json({ message: 'Assignment has no clipId for export' });
    }

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

module.exports = router;
