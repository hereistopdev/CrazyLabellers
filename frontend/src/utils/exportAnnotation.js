import { FPS } from '../config/frameOffsets';
import { internalTimeToOriginPositionMs } from './frameTime';

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

export function exportAnnotation(events, { gameTime = '1 - 00:00', variant = 'post', fps = FPS } = {}) {
  const sorted = [...(events || [])].sort(
    (a, b) => getEventTimeSeconds(a, variant) - getEventTimeSeconds(b, variant)
  );

  return {
    annotations: sorted.map((event) => {
      const timeSec = getEventTimeSeconds(event, variant);
      return {
        gameTime,
        label: toExportLabel(event.eventType, variant),
        position: String(internalTimeToOriginPositionMs(timeSec, fps)),
        team: 'not applicable',
        visibility: 'visible',
      };
    }),
  };
}

export function getExportFilename(basename, variant) {
  const safe = String(basename || 'export')
    .trim()
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w.-]+/g, '_');
  return variant === 'raw' ? `${safe}_post.json` : `${safe}.json`;
}

export function getReferenceExportFilename(basename, variant) {
  const safe = String(basename || 'export')
    .trim()
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w.-]+/g, '_');
  return variant === 'raw' ? `${safe}_reference_post.json` : `${safe}_reference.json`;
}

export function resolveExportBasename({ title, clipId } = {}) {
  for (const value of [title, clipId]) {
    const safe = String(value || '')
      .trim()
      .replace(/\.[^.]+$/, '')
      .replace(/[^\w.-]+/g, '_');
    if (safe && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(safe)) return safe;
  }
  return null;
}

export function downloadAnnotationExport(events, { clipId, variant = 'post', fps = FPS } = {}) {
  const payload = exportAnnotation(events, { variant, fps });
  const filename = getExportFilename(clipId, variant);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
