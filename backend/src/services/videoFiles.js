const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const VideoAssignment = require('../models/VideoAssignment');
const LabelSubmission = require('../models/LabelSubmission');
const { CLIP_ID_PATTERN } = require('../utils/exportAnnotation');
const { validateTaskPrice } = require('../config/payments');
const { getVideoDataDir, buildVideoUrl } = require('./videoStorage');
const { removeStoredVideoFile } = require('./videoStorage');

function ensureVideoDataDir() {
  const dir = getVideoDataDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function resolveClipId(filename) {
  const base = path.basename(filename, path.extname(filename)).toLowerCase();
  if (CLIP_ID_PATTERN.test(base)) {
    return base;
  }
  return crypto.randomBytes(15).toString('hex');
}

function getClipFilePath(clipId) {
  return path.join(getVideoDataDir(), `${clipId}.mp4`);
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
}) {
  const existing = await VideoAssignment.findOne({ clipId });
  if (existing) {
    throw new Error('A video with this clip ID already exists');
  }

  return VideoAssignment.create({
    clipId,
    title: title || clipId,
    description: description || 'Football clip for event labeling',
    videoUrl: videoUrl || buildVideoUrl(clipId),
    gameTime: gameTime || '1 - 00:00',
    durationSeconds: durationSeconds || 30,
    fps: 25,
    taskPrice: taskPrice != null ? validateTaskPrice(taskPrice) : 1,
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
    if (!fileDeleted) {
      const filePath = getClipFilePath(assignment.clipId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        fileDeleted = true;
      }
    }
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
};
