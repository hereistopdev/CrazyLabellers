const DEFAULT_FPS = 25;

/** Origin/local app counts from frame 1; JSON position ms is +1 frame vs internal storage. */
const ORIGIN_JSON_FRAME_OFFSET = 1;

/** Origin labeling app shows frame 1 at clip start; internal math stays 0-based. */
const DISPLAY_FRAME_BASE = 1;

function msPerFrame(fps = DEFAULT_FPS) {
  return 1000 / fps;
}

function toDisplayFrame(internalFrame) {
  return internalFrame + DISPLAY_FRAME_BASE;
}

function fromDisplayFrame(displayFrame) {
  return displayFrame - DISPLAY_FRAME_BASE;
}

function getFrameNumber(time, fps = DEFAULT_FPS) {
  if (!Number.isFinite(time)) return 0;
  return Math.round(time * fps);
}

function getTimeForFrame(frame, fps = DEFAULT_FPS) {
  return frame / fps;
}

/** Snap a timestamp to the nearest frame boundary (e.g. frame 17 → 0.68s at 25fps). */
function snapTimeToFrame(time, fps = DEFAULT_FPS) {
  return getTimeForFrame(getFrameNumber(time, fps), fps);
}

/** Internal snapped time → origin/local JSON `position` (ms). */
function internalTimeToOriginPositionMs(timeSec, fps = DEFAULT_FPS) {
  const snapped = snapTimeToFrame(timeSec, fps);
  return Math.round(snapped * 1000 + ORIGIN_JSON_FRAME_OFFSET * msPerFrame(fps));
}

/** Origin/local JSON `position` (ms) → internal time seconds. */
function originPositionMsToInternalTime(positionMs, fps = DEFAULT_FPS) {
  const adjustedMs = Math.max(0, positionMs - ORIGIN_JSON_FRAME_OFFSET * msPerFrame(fps));
  return snapTimeToFrame(adjustedMs / 1000, fps);
}

function originPositionMsToInternalFrame(positionMs, fps = DEFAULT_FPS) {
  return getFrameNumber(originPositionMsToInternalTime(positionMs, fps), fps);
}

function nudgeFrameTime(frameTime, frameDelta, fps = DEFAULT_FPS) {
  const frame = getFrameNumber(frameTime, fps);
  return getTimeForFrame(Math.max(0, frame + frameDelta), fps);
}

function getFrameDiffFromTimes(timeA, timeB, fps = DEFAULT_FPS) {
  return Math.abs(getFrameNumber(timeA, fps) - getFrameNumber(timeB, fps));
}

module.exports = {
  ORIGIN_JSON_FRAME_OFFSET,
  DISPLAY_FRAME_BASE,
  msPerFrame,
  toDisplayFrame,
  fromDisplayFrame,
  getFrameNumber,
  getTimeForFrame,
  snapTimeToFrame,
  nudgeFrameTime,
  getFrameDiffFromTimes,
  internalTimeToOriginPositionMs,
  originPositionMsToInternalTime,
  originPositionMsToInternalFrame,
};
