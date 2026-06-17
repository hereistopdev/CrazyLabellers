const CLIP_ID_PATTERN = /^[a-f0-9]{30}$/i;

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
  const sorted = [...(events || [])].sort(
    (a, b) => getEventTimeSeconds(a, variant) - getEventTimeSeconds(b, variant)
  );

  return {
    annotations: sorted.map((event) => {
      const timeSec = getEventTimeSeconds(event, variant);
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

function getExportFilename(clipId, variant) {
  if (!CLIP_ID_PATTERN.test(clipId)) {
    throw new Error('Invalid clip ID');
  }
  return variant === 'post' ? `${clipId}_post.json` : `${clipId}.json`;
}

module.exports = { exportAnnotation, getExportFilename, CLIP_ID_PATTERN };
