export const DEFAULT_FPS = 25;

export function getFrameNumber(time, fps = DEFAULT_FPS) {
  if (!Number.isFinite(time)) return 0;
  return Math.round(time * fps);
}

export function getTimeForFrame(frame, fps = DEFAULT_FPS) {
  return frame / fps;
}

/** Snap a timestamp to the nearest frame boundary (e.g. frame 17 → 0.68s at 25fps). */
export function snapTimeToFrame(time, fps = DEFAULT_FPS) {
  return getTimeForFrame(getFrameNumber(time, fps), fps);
}

export function nudgeFrameTime(frameTime, frameDelta, fps = DEFAULT_FPS) {
  const frame = getFrameNumber(frameTime, fps);
  return getTimeForFrame(Math.max(0, frame + frameDelta), fps);
}

export function formatEventTime(seconds, fps = DEFAULT_FPS) {
  const snapped = snapTimeToFrame(seconds, fps);
  const m = Math.floor(snapped / 60);
  const s = (snapped % 60).toFixed(2);
  return `${m}:${s.padStart(5, '0')}`;
}
