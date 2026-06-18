import { FPS } from '../config/frameOffsets';

export function formatTutorialTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2);
  return `${m}:${s.padStart(5, '0')}`;
}

export function getActiveTutorialStep(steps, currentTime, fps = FPS) {
  const currentFrame = Math.round(currentTime * fps);
  return steps.find((step) => Math.abs(Math.round(step.frameTime * fps) - currentFrame) <= 1);
}
