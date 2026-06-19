const { labelToEventType } = require('./parseReferenceAnnotation');
const { FPS } = require('../config/frameOffsets');
const { snapTimeToFrame } = require('./frameTime');

function toPlainObject(value) {
  if (value == null) return value;
  if (typeof value.toObject === 'function') {
    return value.toObject();
  }
  return value;
}

function resolveFrameTime(event) {
  const plain = toPlainObject(event);
  if (!plain) return null;

  const candidates = [plain.frameTime, plain.playheadTime, plain.time, plain.timeSeconds];
  for (const candidate of candidates) {
    const num = typeof candidate === 'number' ? candidate : parseFloat(candidate);
    if (Number.isFinite(num)) return num;
  }

  if (plain.position != null) {
    const ms = parseInt(plain.position, 10);
    if (!Number.isNaN(ms)) return ms / 1000;
  }

  return null;
}

function resolveEventType(event) {
  const plain = toPlainObject(event);
  if (!plain) return null;
  if (plain.eventType) return plain.eventType;
  if (plain.label) return labelToEventType(plain.label);
  return null;
}

function normalizeLabelEvents(events = [], fps = FPS) {
  return events
    .map((event, index) => {
      const plain = toPlainObject(event);
      const eventType = resolveEventType(plain);
      const rawFrameTime = resolveFrameTime(plain);

      if (!eventType || rawFrameTime == null) return null;

      const frameTime = snapTimeToFrame(rawFrameTime, fps);
      const playheadTime = Number.isFinite(plain.playheadTime)
        ? snapTimeToFrame(plain.playheadTime, fps)
        : frameTime;

      return {
        ...plain,
        eventType,
        frameTime,
        playheadTime,
        index,
      };
    })
    .filter(Boolean);
}

module.exports = {
  toPlainObject,
  resolveFrameTime,
  resolveEventType,
  normalizeLabelEvents,
};
