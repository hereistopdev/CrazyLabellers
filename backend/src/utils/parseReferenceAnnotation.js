const { EVENT_TYPES } = require('../config/events');
const { FPS } = require('../config/frameOffsets');
const { snapTimeToFrame } = require('./frameTime');

const EVENT_LABEL_ALIASES = {
  take_on: 'Take on',
  take_on_end: 'Take on End',
  interception: 'Interception',
  interception2: 'Interception 2',
  interception_2: 'Interception 2',
};

function labelToEventType(label) {
  const raw = String(label || '').trim();
  const aliasKey = raw.toLowerCase().replace(/\s+/g, '_');
  if (EVENT_LABEL_ALIASES[aliasKey]) return EVENT_LABEL_ALIASES[aliasKey];

  const normalized = raw.toLowerCase().replace(/_/g, ' ');

  const exact = EVENT_TYPES.find((type) => type.toLowerCase() === normalized);
  if (exact) return exact;

  const compact = normalized.replace(/\s+/g, '');
  const compactMatch = EVENT_TYPES.find(
    (type) => type.toLowerCase().replace(/\s+/g, '') === compact
  );
  if (compactMatch) return compactMatch;

  const snake = raw.toLowerCase();
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
