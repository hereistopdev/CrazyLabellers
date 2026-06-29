const express = require('express');
const ImageAssignment = require('../models/ImageAssignment');
const ImageKeypointSubmission = require('../models/ImageKeypointSubmission');
const TaskGroup = require('../models/TaskGroup');
const { auth } = require('../middleware/auth');
const { isAdmin, isLabeller } = require('../config/roles');
const { hasPassedKnowledgeTest } = require('../services/onboarding');
const {
  normalizeKeypoints,
  keypointsMapToArray,
  countMarkedKeypoints,
  countLabellerExportKeypoints,
  REQUIRED_KEYPOINT_COUNT,
  buildMergedKeypointExportPayload,
  getExportFilename,
} = require('../utils/imageKeypointExport');
const { normalizeImageUrl } = require('../services/imageStorage');
const { ensureImageSubmissionSeeded } = require('../services/imageReferenceDraftSeed');
const { loadReferenceRawJsonForAssignment, hasStoredReferenceForAssignment, getReferenceDimensions, syncAssignmentReferenceDimensions } = require('../services/imageReferenceStorage');
const { getPlatformSettings, isLabellerImageLabelingEnabled } = require('../services/platformSettings');

const router = express.Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

async function canAccessImageLabeling(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (!isLabeller(user)) return false;

  const settings = await getPlatformSettings();
  if (!isLabellerImageLabelingEnabled(settings)) {
    return false;
  }

  return hasPassedKnowledgeTest(user) || user.status === 'approved' || user.status === 'passed_test';
}

async function requireImageLabelingAccess(req, res) {
  if (!(await canAccessImageLabeling(req.user))) {
    if (isLabeller(req.user) && !isAdmin(req.user)) {
      const settings = await getPlatformSettings();
      if (!isLabellerImageLabelingEnabled(settings)) {
        res.status(403).json({ message: 'Image labeling tasks are not available for labellers right now' });
        return false;
      }
    }
    res.status(403).json({ message: 'Pass the knowledge test before image labeling tasks' });
    return false;
  }
  return true;
}

router.get('/', auth, async (req, res) => {
  try {
    if (!(await requireImageLabelingAccess(req, res))) return;

    const filter = isLabeller(req.user) && !isAdmin(req.user)
      ? { $or: [{ assignedTo: req.user._id }, { status: 'available' }] }
      : {};

    const assignments = await ImageAssignment.find(filter)
      .populate('groupId', 'name description sortOrder')
      .populate('assignedTo', 'name email')
      .sort({ sortOrder: 1, createdAt: -1 });

    const submissionCounts = await ImageKeypointSubmission.aggregate([
      { $match: { assignmentId: { $in: assignments.map((row) => row._id) } } },
      { $group: { _id: '$assignmentId', count: { $sum: 1 } } },
    ]);
    const subMap = new Map(submissionCounts.map((row) => [String(row._id), row.count]));

    return res.json(
      assignments.map((assignment) => ({
        ...assignment.toObject(),
        submissionCount: subMap.get(String(assignment._id)) || 0,
      }))
    );
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

function summarizeImageRow(assignment, submission) {
  const map = normalizeKeypoints(submission?.keypoints || []);
  const refDims = getReferenceDimensions(loadReferenceRawJsonForAssignment(assignment), assignment);
  return {
    _id: assignment._id,
    imageId: assignment.imageId,
    title: assignment.title,
    imageUrl: normalizeImageUrl(assignment.imageUrl),
    width: refDims.width || assignment.width || null,
    height: refDims.height || assignment.height || null,
    status: assignment.status,
    sortOrder: assignment.sortOrder,
    assignedTo: assignment.assignedTo,
    allowLabellerReference: Boolean(assignment.allowLabellerReference),
    hasReference: hasStoredReferenceForAssignment(assignment),
    markedCount: countMarkedKeypoints(map),
    requiredCount: REQUIRED_KEYPOINT_COUNT,
    submissionStatus: submission?.status || 'draft',
    reviewerNotes: submission?.reviewerNotes || '',
    isComplete: countMarkedKeypoints(map) >= REQUIRED_KEYPOINT_COUNT,
    keypoints: map,
    keypointsList: keypointsMapToArray(map),
  };
}

async function seedSubmissionIfNeeded(assignment, userId, existingSubmission) {
  return ensureImageSubmissionSeeded(assignment, userId, existingSubmission);
}

function isSubmissionEditable(submission) {
  const status = submission?.status || 'draft';
  return status === 'draft' || status === 'rejected';
}

function isSubmissionLocked(submission) {
  const status = submission?.status || 'draft';
  return status === 'submitted' || status === 'approved';
}

function isAssignedToUserId(assignedTo, userId) {
  if (!assignedTo || !userId) return false;
  return String(assignedTo._id || assignedTo) === String(userId);
}

router.get('/groups', auth, async (req, res) => {
  try {
    if (!(await requireImageLabelingAccess(req, res))) return;

    const filter =
      isLabeller(req.user) && !isAdmin(req.user)
        ? { $or: [{ assignedTo: req.user._id }, { status: 'available' }] }
        : {};

    const assignments = await ImageAssignment.find(filter)
      .populate('groupId', 'name description sortOrder')
      .populate('assignedTo', 'name email')
      .sort({ sortOrder: 1, createdAt: -1 });

    const submissionRows = await ImageKeypointSubmission.find({
      assignmentId: { $in: assignments.map((row) => row._id) },
      ...(isLabeller(req.user) && !isAdmin(req.user) ? { userId: req.user._id } : {}),
    }).select('assignmentId keypoints status');

    const submissionByAssignment = new Map(
      submissionRows.map((row) => [String(row.assignmentId), row])
    );

    const groupMap = new Map();
    for (const assignment of assignments) {
      const group = assignment.groupId;
      const groupKey = group?._id ? String(group._id) : 'ungrouped';
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          groupId: group?._id || null,
          name: group?.name || 'Ungrouped images',
          description: group?.description || '',
          sortOrder: group?.sortOrder ?? 9999,
          imageCount: 0,
          availableCount: 0,
          myCount: 0,
          completeCount: 0,
          submittedCount: 0,
          rejectedCount: 0,
          canClaim: false,
          canOpen: false,
        });
      }

      const bucket = groupMap.get(groupKey);
      bucket.imageCount += 1;

      const submission = submissionByAssignment.get(String(assignment._id));
      const markedCount = countMarkedKeypoints(normalizeKeypoints(submission?.keypoints || []));
      const isComplete = markedCount >= REQUIRED_KEYPOINT_COUNT;
      const isMine = isAssignedToUserId(assignment.assignedTo, req.user._id);

      if (assignment.status === 'available') {
        bucket.availableCount += 1;
        bucket.canClaim = true;
      }

      if (isMine && assignment.status !== 'available') {
        bucket.myCount += 1;
        bucket.canOpen = true;
      }

      if (isMine && isComplete) {
        bucket.completeCount += 1;
      }

      if (isMine && (submission?.status === 'submitted' || assignment.status === 'submitted')) {
        bucket.submittedCount += 1;
      }

      if (isMine && submission?.status === 'rejected') {
        bucket.rejectedCount = (bucket.rejectedCount || 0) + 1;
      }

      if (isAdmin(req.user)) {
        bucket.canOpen = true;
      }

      if (bucket.canClaim || bucket.myCount > 0) {
        bucket.canOpen = true;
      }
    }

    return res.json(
      [...groupMap.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    );
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/groups/:groupId', auth, async (req, res) => {
  try {
    if (!(await requireImageLabelingAccess(req, res))) return;

    const groupId = req.params.groupId;
    const groupFilter =
      groupId === 'ungrouped' ? { groupId: null } : { groupId };

    const assignments = await ImageAssignment.find(groupFilter)
      .populate('assignedTo', 'name email')
      .sort({ sortOrder: 1, imageId: 1, title: 1 });

    if (!assignments.length) {
      return res.status(404).json({ message: 'Image group not found' });
    }

    const groupDoc =
      groupId === 'ungrouped'
        ? null
        : await TaskGroup.findById(groupId).select('name description sortOrder');

    if (groupId !== 'ungrouped' && !groupDoc) {
      return res.status(404).json({ message: 'Image group not found' });
    }

    const group =
      groupId === 'ungrouped'
        ? { _id: null, name: 'Ungrouped images', description: '', sortOrder: 9999 }
        : {
            _id: groupDoc._id,
            name: groupDoc.name,
            description: groupDoc.description || '',
            sortOrder: groupDoc.sortOrder ?? 0,
          };

    const submissions = await ImageKeypointSubmission.find({
      assignmentId: { $in: assignments.map((row) => row._id) },
      userId: req.user._id,
    });

    const submissionByAssignment = new Map(
      submissions.map((row) => [String(row.assignmentId), row])
    );

    for (const assignment of assignments) {
      if (hasStoredReferenceForAssignment(assignment)) {
        await syncAssignmentReferenceDimensions(assignment);
      }
      if (!isAssignedToUserId(assignment.assignedTo, req.user._id)) {
        continue;
      }
      const existing = submissionByAssignment.get(String(assignment._id));
      const seeded = await seedSubmissionIfNeeded(assignment, req.user._id, existing);
      if (seeded && seeded !== existing) {
        submissionByAssignment.set(String(assignment._id), seeded);
      }
    }

    const images = assignments.map((assignment) => {
      const submission = submissionByAssignment.get(String(assignment._id));
      return summarizeImageRow(assignment, submission);
    });

    const mine = images.filter((row) => isAssignedToUserId(row.assignedTo, req.user._id));
    const availableCount = images.filter((row) => row.status === 'available').length;
    const canClaim = availableCount > 0 && !isAdmin(req.user);
    const canLabel =
      isAdmin(req.user) ||
      mine.some((row) => ['assigned', 'in_progress', 'submitted', 'rejected'].includes(row.status));

    return res.json({
      group,
      images,
      stats: {
        total: images.length,
        available: availableCount,
        mine: mine.length,
        complete: mine.filter((row) => row.isComplete).length,
        submitted: mine.filter((row) => row.submissionStatus === 'submitted').length,
        rejected: mine.filter((row) => row.submissionStatus === 'rejected').length,
      },
      access: {
        canClaim: canClaim && !isAdmin(req.user),
        canLabel,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/groups/:groupId/nav', auth, async (req, res) => {
  try {
    if (!(await requireImageLabelingAccess(req, res))) return;

    const groupFilter =
      req.params.groupId === 'ungrouped' ? { groupId: null } : { groupId: req.params.groupId };

    const items = await ImageAssignment.find(groupFilter)
      .select('_id imageId title status sortOrder imageUrl')
      .sort({ sortOrder: 1, imageId: 1, title: 1 });

    return res.json(items);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/groups/:groupId/claim', auth, async (req, res) => {
  try {
    if (!(await requireImageLabelingAccess(req, res))) return;

    const groupFilter =
      req.params.groupId === 'ungrouped' ? { groupId: null } : { groupId: req.params.groupId };

    const available = await ImageAssignment.find({ ...groupFilter, status: 'available' });
    if (!available.length) {
      return res.status(400).json({ message: 'No available images to claim in this project' });
    }

    const claimed = [];
    for (const assignment of available) {
      assignment.assignedTo = req.user._id;
      assignment.status = 'assigned';
      await assignment.save();

      const existing = await ImageKeypointSubmission.findOne({
        assignmentId: assignment._id,
        userId: req.user._id,
      });
      await ensureImageSubmissionSeeded(assignment, req.user._id, existing);

      claimed.push(assignment);
    }

    return res.json({
      message: `Claimed ${claimed.length} image${claimed.length === 1 ? '' : 's'}`,
      claimed: claimed.length,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/groups/:groupId/export', auth, async (req, res) => {
  try {
    if (!(await requireImageLabelingAccess(req, res))) return;

    const { buildImageGroupExport } = require('../services/imageGroupExport');
    const { sendGroupExportZip } = require('../services/groupExport');
    const result = await buildImageGroupExport({
      groupId: req.params.groupId,
      userId: req.user._id,
      draft: false,
    });
    return sendGroupExportZip(res, result);
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }
});

router.post('/groups/:groupId/export', auth, async (req, res) => {
  try {
    if (!(await requireImageLabelingAccess(req, res))) return;

    const submissions = Array.isArray(req.body.submissions) ? req.body.submissions : [];
    if (!submissions.length) {
      return res.status(400).json({ message: 'No labeling data to export' });
    }

    const groupFilter =
      req.params.groupId === 'ungrouped' ? { groupId: null } : { groupId: req.params.groupId };
    const assignmentIds = submissions.map((row) => row.assignmentId).filter(Boolean);
    const assignments = await ImageAssignment.find({ ...groupFilter, _id: { $in: assignmentIds } });

    if (assignments.length !== assignmentIds.length) {
      return res.status(400).json({ message: 'One or more images do not belong to this project' });
    }

    if (isLabeller(req.user) && !isAdmin(req.user)) {
      for (const assignment of assignments) {
        if (!isAssignedToUserId(assignment.assignedTo, req.user._id)) {
          return res.status(403).json({ message: 'Claim this project before downloading your draft' });
        }
      }
    }

    const { buildImageGroupExport } = require('../services/imageGroupExport');
    const { sendGroupExportZip } = require('../services/groupExport');
    const result = await buildImageGroupExport({
      groupId: req.params.groupId,
      userId: req.user._id,
      draft: true,
      submissionRows: submissions,
    });
    return sendGroupExportZip(res, result);
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }
});

router.post('/groups/:groupId/submit', auth, async (req, res) => {
  try {
    if (!(await requireImageLabelingAccess(req, res))) return;

    const mode = req.body.mode === 'draft' ? 'draft' : 'final';
    const groupFilter =
      req.params.groupId === 'ungrouped' ? { groupId: null } : { groupId: req.params.groupId };

    const submissions = Array.isArray(req.body.submissions) ? req.body.submissions : [];
    if (!submissions.length) {
      return res.status(400).json({ message: 'No submissions provided' });
    }

    const assignmentIds = submissions.map((row) => row.assignmentId).filter(Boolean);
    const assignments = await ImageAssignment.find({ ...groupFilter, _id: { $in: assignmentIds } });
    const assignmentMap = new Map(assignments.map((row) => [String(row._id), row]));

    if (assignments.length !== assignmentIds.length) {
      return res.status(400).json({ message: 'One or more images do not belong to this project' });
    }

    let savedCount = 0;
    for (const row of submissions) {
      const assignment = assignmentMap.get(String(row.assignmentId));
      if (!assignment) continue;

      if (
        isLabeller(req.user) &&
        !isAdmin(req.user) &&
        assignment.assignedTo?.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({ message: 'Claim this project before submitting' });
      }

      const existing = await ImageKeypointSubmission.findOne({
        assignmentId: assignment._id,
        userId: req.user._id,
      });

      if (existing && isSubmissionLocked(existing) && mode === 'draft') {
        return res.status(403).json({
          message: `Frame "${assignment.imageId}" is submitted — wait for review or resubmit after rejection`,
        });
      }

      if (mode === 'final' && existing?.status === 'approved') {
        return res.status(403).json({ message: `Frame "${assignment.imageId}" is already approved` });
      }

      if (mode === 'final' && existing?.status === 'submitted') {
        return res.status(403).json({
          message: `Frame "${assignment.imageId}" is already submitted and awaiting review`,
        });
      }

      const map = normalizeKeypoints(row.keypoints || row.keypointsList || []);
      if (mode === 'final' && countMarkedKeypoints(map) < REQUIRED_KEYPOINT_COUNT) {
        return res.status(400).json({
          message: `Frame "${assignment.imageId}" is missing points — mark pitch + kp0–kp8 on every frame`,
        });
      }

      if (mode === 'draft' && countMarkedKeypoints(map) === 0) {
        continue;
      }

      const keypoints = keypointsMapToArray(map);
      const update =
        mode === 'final'
          ? {
              $set: { keypoints, status: 'submitted', reviewerNotes: '' },
              $unset: { reviewPoints: '', reviewedAt: '', reviewedBy: '' },
            }
          : { $set: { keypoints, status: 'draft' } };

      await ImageKeypointSubmission.findOneAndUpdate(
        { assignmentId: assignment._id, userId: req.user._id },
        update,
        { upsert: true, new: true }
      );

      assignment.status = mode === 'draft' ? 'in_progress' : 'submitted';
      if (row.width) assignment.width = row.width;
      if (row.height) assignment.height = row.height;
      await assignment.save();
      savedCount += 1;
    }

    if (savedCount === 0 && mode === 'draft') {
      return res.status(400).json({ message: 'Nothing to save — mark at least one point first' });
    }

    const label = mode === 'draft' ? 'Draft saved' : 'Submitted';
    return res.json({
      message: `${label} ${savedCount} frame${savedCount === 1 ? '' : 's'}`,
      saved: savedCount,
      mode,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const assignment = await ImageAssignment.findById(req.params.id)
      .populate('groupId', 'name description sortOrder')
      .populate('assignedTo', 'name email');

    if (!assignment) {
      return res.status(404).json({ message: 'Image assignment not found' });
    }

    if (
      isLabeller(req.user) &&
      !isAdmin(req.user) &&
      assignment.assignedTo &&
      assignment.assignedTo._id?.toString() !== req.user._id.toString() &&
      assignment.status !== 'available'
    ) {
      return res.status(403).json({ message: 'You are not assigned to this image' });
    }

    return res.json(assignment);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/:id/claim', auth, async (req, res) => {
  try {
    if (!(await requireImageLabelingAccess(req, res))) return;

    const assignment = await ImageAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Image assignment not found' });
    }

    if (assignment.status !== 'available') {
      return res.status(400).json({ message: 'Image is not available to claim' });
    }

    assignment.assignedTo = req.user._id;
    assignment.status = 'assigned';
    await assignment.save();

    await ImageKeypointSubmission.findOneAndUpdate(
      { assignmentId: assignment._id, userId: req.user._id },
      { $setOnInsert: { keypoints: [], status: 'draft' } },
      { upsert: true, new: true }
    );

    return res.json(assignment);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/:id/keypoints', auth, async (req, res) => {
  try {
    const assignment = await ImageAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Image assignment not found' });
    }

    const filter = { assignmentId: assignment._id };
    if (isLabeller(req.user) && !isAdmin(req.user)) {
      filter.userId = req.user._id;
    }

    let submission = await ImageKeypointSubmission.findOne(filter);
    if (!submission && isLabeller(req.user)) {
      submission = await ImageKeypointSubmission.create({
        assignmentId: assignment._id,
        userId: req.user._id,
        keypoints: [],
        status: 'draft',
      });
    }

    const map = normalizeKeypoints(submission?.keypoints || []);

    return res.json({
      keypoints: map,
      keypointsList: keypointsMapToArray(map),
      markedCount: countMarkedKeypoints(map),
      requiredCount: REQUIRED_KEYPOINT_COUNT,
      status: submission?.status || 'draft',
      submissionId: submission?._id || null,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.put('/:id/keypoints', auth, async (req, res) => {
  try {
    const assignment = await ImageAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Image assignment not found' });
    }

    if (
      isLabeller(req.user) &&
      !isAdmin(req.user) &&
      assignment.assignedTo?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Claim this image before labeling' });
    }

    const existing = await ImageKeypointSubmission.findOne({
      assignmentId: assignment._id,
      userId: req.user._id,
    });

    if (existing && isSubmissionLocked(existing)) {
      return res.status(403).json({
        message: 'This frame is submitted and locked until review completes or admin rejects it',
      });
    }

    const map = normalizeKeypoints(req.body.keypoints || req.body.keypointsList || []);
    const keypoints = keypointsMapToArray(map);

    let submission = await ImageKeypointSubmission.findOneAndUpdate(
      { assignmentId: assignment._id, userId: req.user._id },
      { keypoints, status: 'draft' },
      { upsert: true, new: true }
    );

    if (assignment.status === 'assigned') {
      assignment.status = 'in_progress';
      await assignment.save();
    }

    return res.json({
      keypoints: map,
      keypointsList: keypoints,
      markedCount: countMarkedKeypoints(map),
      requiredCount: REQUIRED_KEYPOINT_COUNT,
      status: submission.status,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.post('/:id/submit', auth, async (req, res) => {
  try {
    const assignment = await ImageAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Image assignment not found' });
    }

    const submission = await ImageKeypointSubmission.findOne({
      assignmentId: assignment._id,
      userId: req.user._id,
    });

    if (!submission) {
      return res.status(400).json({ message: 'No keypoints saved yet' });
    }

    const map = normalizeKeypoints(submission.keypoints);
    if (countMarkedKeypoints(map) < REQUIRED_KEYPOINT_COUNT) {
      return res.status(400).json({
        message: `Mark all ${REQUIRED_KEYPOINT_COUNT} points before submitting (pitch + kp0–kp8)`,
      });
    }

    if (submission.status === 'submitted') {
      return res.status(403).json({ message: 'Already submitted — awaiting review' });
    }

    if (submission.status === 'approved') {
      return res.status(403).json({ message: 'Already approved' });
    }

    submission.status = 'submitted';
    submission.reviewerNotes = '';
    submission.reviewPoints = undefined;
    submission.reviewedAt = undefined;
    submission.reviewedBy = undefined;
    await submission.save();

    assignment.status = 'submitted';
    await assignment.save();

    return res.json({ message: 'Submitted', status: submission.status });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/:id/reference', auth, async (req, res) => {
  try {
    if (!(await requireImageLabelingAccess(req, res))) return;

    const assignment = await ImageAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Image assignment not found' });
    }

    if (isLabeller(req.user) && !isAdmin(req.user)) {
      if (!assignment.allowLabellerReference) {
        return res.status(403).json({ message: 'Reference is not shared for this task' });
      }
      if (!isAssignedToUserId(assignment.assignedTo, req.user._id)) {
        return res.status(403).json({ message: 'Claim this image before viewing reference' });
      }
    }

    if (!hasStoredReferenceForAssignment(assignment)) {
      if (assignment.hasReference) {
        assignment.hasReference = false;
        if (assignment.allowLabellerReference) {
          assignment.allowLabellerReference = false;
        }
        await assignment.save();
      }
      return res.json({
        hasReference: false,
        raw: null,
        message: 'No reference JSON stored for this image. Re-upload the reference JSON from Manage Images.',
      });
    }

    const raw = loadReferenceRawJsonForAssignment(assignment);
    if (!raw) {
      return res.json({
        hasReference: false,
        raw: null,
        message: 'Reference JSON could not be read. Re-upload the reference JSON from Manage Images.',
      });
    }

    if (!assignment.hasReference) {
      assignment.hasReference = true;
      await assignment.save();
    }

    return res.json({
      hasReference: true,
      raw,
      imageId: assignment.imageId,
      title: assignment.title,
    });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.get('/:id/export', auth, async (req, res) => {
  try {
    const assignment = await ImageAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Image assignment not found' });
    }

    const filter = { assignmentId: assignment._id };
    if (isLabeller(req.user) && !isAdmin(req.user)) {
      filter.userId = req.user._id;
    }

    const submission = await ImageKeypointSubmission.findOne(filter).sort({ updatedAt: -1 });
    const map = normalizeKeypoints(submission?.keypoints || []);
    if (countLabellerExportKeypoints(map) === 0) {
      return res.status(404).json({ message: 'No kp0–kp8 keypoints to export' });
    }

    const payload = buildMergedKeypointExportPayload(assignment, map);
    const filename = getExportFilename(assignment.imageId);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(payload, null, 2));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

module.exports = router;
