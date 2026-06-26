const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function isArrowKey(key) {
  return ARROW_KEYS.has(key);
}

export function arrowNudgeStep(event) {
  if (event.shiftKey && (event.ctrlKey || event.metaKey)) return 10;
  if (event.shiftKey) return 5;
  if (event.ctrlKey || event.metaKey) return 1;
  return 0.25;
}

export function arrowNudgeDelta(key, stepPixels) {
  switch (key) {
    case 'ArrowUp':
      return { dx: 0, dy: -stepPixels };
    case 'ArrowDown':
      return { dx: 0, dy: stepPixels };
    case 'ArrowLeft':
      return { dx: -stepPixels, dy: 0 };
    case 'ArrowRight':
      return { dx: stepPixels, dy: 0 };
    default:
      return null;
  }
}

export function nudgeNormalizedPoint(point, delta, imageWidth, imageHeight) {
  if (!point || !imageWidth || !imageHeight) return point;
  return {
    x: Math.min(1, Math.max(0, point.x + delta.dx / imageWidth)),
    y: Math.min(1, Math.max(0, point.y + delta.dy / imageHeight)),
  };
}
