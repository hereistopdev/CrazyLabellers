const VideoAssignment = require('../models/VideoAssignment');
const { isLabeller, isAdmin } = require('../config/roles');
const { isAssignedLabeller } = require('./labellerAssignmentAccess');
const {
  canAccessTutorial,
  canAccessPretest,
  canAccessProduction,
  isPretestClipForUser,
} = require('./onboarding');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeUrlInput(input) {
  return String(input || '').trim();
}

function normalizeUrlForComparison(input) {
  const trimmed = normalizeUrlInput(input);
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${pathname}${parsed.search}`;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

function extractAssignmentIdFromLabelUrl(input) {
  const match = String(input).match(/\/label\/([a-f0-9]{24})/i);
  return match ? match[1] : null;
}

function extractChunkFilename(input) {
  const chunksMatch = String(input).match(/\/chunks\/([^/?#]+)/i);
  if (chunksMatch) {
    return decodeURIComponent(chunksMatch[1]);
  }
  return null;
}

function extractClipIdFromVideoUrl(input) {
  const chunkFilename = extractChunkFilename(input);
  if (chunkFilename) {
    return chunkFilename.replace(/\.[^.]+$/i, '');
  }

  const apiMatch = String(input).match(/\/api\/videos\/([^/?#]+)/i);
  if (apiMatch) {
    return decodeURIComponent(apiMatch[1]).replace(/\.[^.]+$/i, '');
  }

  try {
    const parsed = new URL(input, 'http://placeholder.local');
    const pathBase = parsed.pathname.split('/').pop() || '';
    if (/\.(mp4|webm|mov|m4v)$/i.test(pathBase)) {
      return decodeURIComponent(pathBase).replace(/\.[^.]+$/i, '');
    }
  } catch {
    // not a full URL — fall through
  }

  const basename = String(input).split('/').pop()?.split('?')[0] || '';
  if (/\.(mp4|webm|mov|m4v)$/i.test(basename)) {
    return basename.replace(/\.[^.]+$/i, '');
  }

  return null;
}

async function findByVideoUrlLoose(trimmed) {
  const normalized = normalizeUrlForComparison(trimmed);
  if (normalized) {
    const byNormalized = await VideoAssignment.findOne({
      videoUrl: { $regex: new RegExp(`${escapeRegex(normalized)}$`, 'i') },
    });
    if (byNormalized) return byNormalized;
  }

  const byExactCi = await VideoAssignment.findOne({
    videoUrl: { $regex: new RegExp(`^${escapeRegex(trimmed)}$`, 'i') },
  });
  if (byExactCi) return byExactCi;

  const filename = trimmed.split('/').pop()?.split('?')[0]?.split('#')[0];
  if (filename) {
    const byFilename = await VideoAssignment.findOne({
      videoUrl: { $regex: new RegExp(`${escapeRegex(filename)}$`, 'i') },
    });
    if (byFilename) return byFilename;
  }

  const chunkFilename = extractChunkFilename(trimmed);
  if (chunkFilename) {
    const chunkId = chunkFilename.replace(/\.[^.]+$/i, '');
    const byChunk = await VideoAssignment.findOne({
      $or: [
        { videoUrl: { $regex: new RegExp(`/chunks/${escapeRegex(chunkFilename)}$`, 'i') } },
        { videoUrl: { $regex: new RegExp(`${escapeRegex(chunkId)}`, 'i') } },
        { clipId: { $regex: new RegExp(`^${escapeRegex(chunkId)}$`, 'i') } },
      ],
    });
    if (byChunk) return byChunk;
  }

  return null;
}

async function resolveAssignmentFromUrlInput(input) {
  const trimmed = normalizeUrlInput(input);
  if (!trimmed) return null;

  const labelId = extractAssignmentIdFromLabelUrl(trimmed);
  if (labelId) {
    return VideoAssignment.findById(labelId);
  }

  const exact = await VideoAssignment.findOne({ videoUrl: trimmed });
  if (exact) return exact;

  const loose = await findByVideoUrlLoose(trimmed);
  if (loose) return loose;

  const clipId = extractClipIdFromVideoUrl(trimmed);
  if (clipId) {
    const byClip = await VideoAssignment.findOne({
      clipId: { $regex: new RegExp(`^${escapeRegex(clipId)}$`, 'i') },
    });
    if (byClip) return byClip;

    const byVideoPath = await VideoAssignment.findOne({
      videoUrl: { $regex: new RegExp(escapeRegex(clipId), 'i') },
    });
    if (byVideoPath) return byVideoPath;
  }

  const suffix = trimmed.replace(/^https?:\/\/[^/]+/i, '');
  if (suffix && suffix !== trimmed) {
    const bySuffix = await VideoAssignment.findOne({
      videoUrl: { $regex: new RegExp(`${escapeRegex(suffix)}$`, 'i') },
    });
    if (bySuffix) return bySuffix;
  }

  return null;
}

function canLabellerOpenAssignment(user, assignment) {
  if (!assignment) return { allowed: false, message: 'Assignment not found' };
  if (isAdmin(user)) return { allowed: true };

  if (!isLabeller(user)) {
    return { allowed: false, message: 'Not authorized' };
  }

  const kind = assignment.kind || 'production';

  if (kind === 'tutorial') {
    if (!canAccessTutorial(user)) {
      return { allowed: false, message: 'Pass the knowledge test first' };
    }
    return { allowed: true };
  }

  if (kind === 'pretest') {
    if (!canAccessPretest(user)) {
      return { allowed: false, message: 'Complete tutorials before the video pre-test' };
    }
    if (!isPretestClipForUser(user, assignment._id)) {
      return { allowed: false, message: 'This pre-test clip is not in your set' };
    }
    return { allowed: true };
  }

  if (!canAccessProduction(user)) {
    return {
      allowed: false,
      message: 'Pass the video pre-test (80/100+) before real tasks',
    };
  }

  if (isAssignedLabeller(user, assignment)) {
    return { allowed: true };
  }

  if (assignment.status === 'available') {
    return { allowed: true, needsClaim: true };
  }

  if (assignment.assignedTo) {
    return { allowed: false, message: 'This task is assigned to another labeller' };
  }

  return {
    allowed: false,
    message: 'You are not assigned to this video',
  };
}

module.exports = {
  resolveAssignmentFromUrlInput,
  canLabellerOpenAssignment,
  extractAssignmentIdFromLabelUrl,
  extractClipIdFromVideoUrl,
  extractChunkFilename,
  normalizeUrlForComparison,
};
