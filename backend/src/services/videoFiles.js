const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const VideoAssignment = require('../models/VideoAssignment');
const LabelSubmission = require('../models/LabelSubmission');
const { clipIdFromFilename, isSafeClipId, getVideoExtension } = require('../utils/clipId');
const { validateTaskPrice, isFreeTaskKind, DEFAULT_TASK_PRICE } = require('../config/payments');
const { getVideoDataDir, buildVideoUrl, findLocalVideoPath } = require('./videoStorage');
const { removeStoredVideoFile } = require('./videoStorage');

function ensureVideoDataDir() {
  const dir = getVideoDataDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function resolveClipId(filename, explicitClipId) {
  if (explicitClipId && isSafeClipId(explicitClipId)) {
    return explicitClipId;
  }

  const fromName = clipIdFromFilename(filename);
  if (fromName && isSafeClipId(fromName)) {
    return fromName;
  }

  return crypto.randomBytes(15).toString('hex');
}

function getClipFilePath(clipId) {
  return findLocalVideoPath(clipId) || path.join(getVideoDataDir(), `${clipId}.mp4`);
}

async function createVideoAssignment({
  clipId,
  title,
  description,
  gameTime,
  durationSeconds,
  videoUrl,
  taskPrice,
  challengeNote,
  kind,
  sortOrder,
  videoExtension,
}) {
  const existing = await VideoAssignment.findOne({ clipId });
  if (existing) {
    throw new Error('A video with this clip ID already exists');
  }

  const validKinds = ['tutorial', 'pretest', 'production'];
  const taskKind = validKinds.includes(kind) ? kind : 'production';
  const resolvedPrice = isFreeTaskKind(taskKind)
    ? 0
    : taskPrice != null
      ? validateTaskPrice(taskPrice, { kind: taskKind })
      : DEFAULT_TASK_PRICE;

  const ext = videoExtension || '.mp4';

  return VideoAssignment.create({
    clipId,
    title: title || clipId,
    description: description || 'Football clip for event labeling',
    videoUrl: videoUrl || buildVideoUrl(clipId, ext),
    gameTime: gameTime || '1 - 00:00',
    durationSeconds: durationSeconds || 30,
    fps: 25,
    kind: taskKind,
    sortOrder: parseInt(sortOrder, 10) || 0,
    taskPrice: resolvedPrice,
    challengeNote: challengeNote || '',
    status: 'available',
  });
}

async function removeVideoAssignment(assignmentId, { deleteFile = true } = {}) {
  const assignment = await VideoAssignment.findById(assignmentId);
  if (!assignment) {
    throw new Error('Video not found');
  }

  await LabelSubmission.deleteMany({ assignmentId: assignment._id });
  await VideoAssignment.findByIdAndDelete(assignment._id);

  let fileDeleted = false;
  if (deleteFile && assignment.clipId) {
    fileDeleted = await removeStoredVideoFile(assignment.clipId);
    await require('./referenceStorage').deleteReferenceForClip(assignment.clipId);
  }

  return { assignment, fileDeleted };
}

module.exports = {
  ensureVideoDataDir,
  resolveClipId,
  getClipFilePath,
  createVideoAssignment,
  removeVideoAssignment,
  getVideoExtension,
};
