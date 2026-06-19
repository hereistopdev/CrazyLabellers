const DEFAULT_FPS = 25;

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

function nudgeFrameTime(frameTime, frameDelta, fps = DEFAULT_FPS) {
  const frame = getFrameNumber(frameTime, fps);
  return getTimeForFrame(Math.max(0, frame + frameDelta), fps);
}

function getFrameDiffFromTimes(timeA, timeB, fps = DEFAULT_FPS) {
  return Math.abs(getFrameNumber(timeA, fps) - getFrameNumber(timeB, fps));
}

module.exports = {
  getFrameNumber,
  getTimeForFrame,
  snapTimeToFrame,
  nudgeFrameTime,
  getFrameDiffFromTimes,
};
