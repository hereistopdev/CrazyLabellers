const { isSafeClipId, sanitizeClipId } = require('./clipId');
const { FPS } = require('../config/frameOffsets');

// Legacy alias kept for existing imports.
const CLIP_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

function getNewEventIndices(events = [], referenceEvents = [], fps = FPS) {
  if (!referenceEvents?.length || !events?.length) return new Set();
  const { compareAnnotations, DEFAULT_TOLERANCE_MS } = require('./compareAnnotations');
  const comparison = compareAnnotations(events, referenceEvents, DEFAULT_TOLERANCE_MS, fps);
  return new Set(comparison.extraInSubmission.map((item) => item.submissionIndex));
}

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

function exportAnnotation(
  events,
  { gameTime = '1 - 00:00', variant = 'post', fps = FPS, referenceEvents, newEventIndices } = {}
) {
  const { internalTimeToOriginPositionMs } = require('./frameTime');
  const eventsList = events || [];
  const newIndices =
    newEventIndices ||
    (referenceEvents?.length ? getNewEventIndices(eventsList, referenceEvents, fps) : new Set());

  const indexed = eventsList.map((event, index) => ({ event, index }));
  const sorted = [...indexed].sort(
    (a, b) => getEventTimeSeconds(a.event, variant) - getEventTimeSeconds(b.event, variant)
  );

  return {
    annotations: sorted.map(({ event, index }) => {
      const timeSec = getEventTimeSeconds(event, variant);
      const record = {
        gameTime,
        label: toExportLabel(event.eventType, variant),
        position: String(internalTimeToOriginPositionMs(timeSec, fps)),
        team: 'not applicable',
        visibility: 'visible',
      };
      if (newIndices.has(index) || event.isNew) {
        record.is_new = true;
      }
      return record;
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
  getNewEventIndices,
  getExportFilename,
  resolveExportBasename,
  CLIP_ID_PATTERN,
  isValidClipId,
};
