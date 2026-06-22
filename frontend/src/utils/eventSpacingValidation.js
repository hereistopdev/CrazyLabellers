import { FPS } from '../config/frameOffsets';
import { getFrameNumber } from './frameTime';

function buildEventFrames(events, fps = FPS) {
  return (events || []).map((event, index) => ({
    index,
    eventType: event.eventType,
    frame: getFrameNumber(event.frameTime, fps),
    frameTime: event.frameTime,
  }));
}

export function validateEventSpacing(events, fps = FPS) {
  const items = buildEventFrames(events, fps);
  const issues = [];

  if (items.length === 0) {
    return { valid: true, issues: [], affectedIndices: [] };
  }

  const byFrame = new Map();
  for (const item of items) {
    if (!byFrame.has(item.frame)) byFrame.set(item.frame, []);
    byFrame.get(item.frame).push(item);
  }

  for (const [frame, frameItems] of byFrame) {
    if (frameItems.length > 1) {
      issues.push({
        kind: 'same_frame',
        frame,
        events: frameItems,
        message: `Frame ${frame} has ${frameItems.length} events (${frameItems.map((i) => i.eventType).join(', ')}) — only one event per frame is allowed`,
      });
    }
  }

  const sorted = [...items].sort((a, b) => a.frame - b.frame || a.index - b.index);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const gap = next.frame - current.frame;
    if (gap === 1) {
      issues.push({
        kind: 'adjacent_frames',
        frameA: current.frame,
        frameB: next.frame,
        events: [current, next],
        message: `${current.eventType} (F${current.frame}) and ${next.eventType} (F${next.frame}) are on consecutive frames — leave at least one blank frame between events`,
      });
    }
  }

  const affectedIndices = [...new Set(issues.flatMap((issue) => issue.events.map((e) => e.index)))];

  return {
    valid: issues.length === 0,
    issues,
    affectedIndices,
  };
}

export function getEventSpacingRuleSummary() {
  return 'Only one event per frame, with at least one blank frame between any two events.';
}
