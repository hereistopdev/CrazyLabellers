export const DEFAULT_FPS = 25;

/** Origin/local app counts from frame 1; JSON position ms is +1 frame vs internal storage. */
export const ORIGIN_JSON_FRAME_OFFSET = 1;

/** Origin labeling app shows frame 1 at clip start; internal math stays 0-based. */
export const DISPLAY_FRAME_BASE = 1;

export function msPerFrame(fps = DEFAULT_FPS) {
  return 1000 / fps;
}

export function toDisplayFrame(internalFrame) {
  return internalFrame + DISPLAY_FRAME_BASE;
}

export function fromDisplayFrame(displayFrame) {
  return displayFrame - DISPLAY_FRAME_BASE;
}

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

/** Internal snapped time → origin/local JSON `position` (ms string). */
export function internalTimeToOriginPositionMs(timeSec, fps = DEFAULT_FPS) {
  const snapped = snapTimeToFrame(timeSec, fps);
  return Math.round(snapped * 1000 + ORIGIN_JSON_FRAME_OFFSET * msPerFrame(fps));
}

/** Origin/local JSON `position` (ms) → internal time seconds. */
export function originPositionMsToInternalTime(positionMs, fps = DEFAULT_FPS) {
  const adjustedMs = Math.max(0, positionMs - ORIGIN_JSON_FRAME_OFFSET * msPerFrame(fps));
  return snapTimeToFrame(adjustedMs / 1000, fps);
}

export function originPositionMsToInternalFrame(positionMs, fps = DEFAULT_FPS) {
  return getFrameNumber(originPositionMsToInternalTime(positionMs, fps), fps);
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
