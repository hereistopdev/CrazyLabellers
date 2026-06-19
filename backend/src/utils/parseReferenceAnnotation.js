const { EVENT_TYPES } = require('../config/events');
const { FPS } = require('../config/frameOffsets');
const { snapTimeToFrame } = require('./frameTime');

function labelToEventType(label) {
  const normalized = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');

  const exact = EVENT_TYPES.find((type) => type.toLowerCase() === normalized);
  if (exact) return exact;

  const snake = String(label || '').trim().toLowerCase();
  return EVENT_TYPES.find((type) => type.toLowerCase().replace(/\s+/g, '_') === snake) || null;
}

function parseReferenceAnnotation(data) {
  const annotations = data?.annotations || [];

  return annotations
    .map((annotation, index) => {
      const eventType = labelToEventType(annotation.label);
      if (!eventType) return null;

      const positionMs = parseInt(annotation.position, 10);
      if (Number.isNaN(positionMs)) return null;

      return {
        eventType,
        frameTime: snapTimeToFrame(positionMs / 1000, FPS),
        index,
      };
    })
    .filter(Boolean);
}

module.exports = { labelToEventType, parseReferenceAnnotation };
