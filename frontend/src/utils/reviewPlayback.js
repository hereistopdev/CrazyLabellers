import { getFrameNumber } from './frameTime';

export { getFrameNumber, getTimeForFrame, snapTimeToFrame, nudgeFrameTime } from './frameTime';

export function buildSortedEventFrames(submissionEvents = [], referenceEvents = [], fps) {
  const frames = new Set();

  submissionEvents.forEach((event) => {
    frames.add(getFrameNumber(event.frameTime, fps));
  });

  referenceEvents.forEach((event) => {
    frames.add(getFrameNumber(event.frameTime, fps));
  });

  return Array.from(frames).sort((a, b) => a - b);
}

export function findNextEventFrame(currentFrame, eventFrames) {
  return eventFrames.find((frame) => frame > currentFrame) ?? null;
}

export function findPrevEventFrame(currentFrame, eventFrames) {
  for (let i = eventFrames.length - 1; i >= 0; i -= 1) {
    if (eventFrames[i] < currentFrame) return eventFrames[i];
  }
  return null;
}

export function isEventFrame(frame, eventFrames) {
  return eventFrames.includes(frame);
}
