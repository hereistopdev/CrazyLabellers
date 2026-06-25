const { isSafeClipId, sanitizeClipId } = require('./clipId');

// Legacy alias kept for existing imports.
const CLIP_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

function isValidClipId(clipId) {
  return isSafeClipId(clipId);
}

function toExportLabel(eventType, variant) {
  const snake = eventType.trim().replace(/\s+/g, '_');
  return variant === 'post' ? snake.toLowerCase() : snake.toUpperCase();
}

function getEventTimeSeconds(event, variant) {
  if (variant === 'post') {
    return event.frameTime;
  }
  return event.playheadTime ?? event.frameTime;
}

function exportAnnotation(events, { gameTime = '1 - 00:00', variant = 'post' } = {}) {
  const { snapTimeToFrame } = require('./frameTime');
  const { FPS } = require('../config/frameOffsets');
  const sorted = [...(events || [])].sort(
    (a, b) => getEventTimeSeconds(a, variant) - getEventTimeSeconds(b, variant)
  );

  return {
    annotations: sorted.map((event) => {
      const timeSec = snapTimeToFrame(getEventTimeSeconds(event, variant), FPS);
      return {
        gameTime,
        label: toExportLabel(event.eventType, variant),
        position: String(Math.round(timeSec * 1000)),
        team: 'not applicable',
        visibility: 'visible',
      };
    }),
  };
}

function resolveExportBasename({ title, clipId } = {}) {
  for (const value of [title, clipId]) {
    const stem = sanitizeClipId(value);
    if (stem && isSafeClipId(stem)) return stem;
  }
  return null;
}

function getExportFilename(basename, variant) {
  const stem = sanitizeClipId(basename) || String(basename || '').trim();
  if (!isValidClipId(stem)) {
    throw new Error('Invalid export name');
  }
  return variant === 'raw' ? `${stem}_post.json` : `${stem}.json`;
}

module.exports = {
  exportAnnotation,
  getExportFilename,
  resolveExportBasename,
  CLIP_ID_PATTERN,
  isValidClipId,
};
