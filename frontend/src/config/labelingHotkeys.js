export const LABELING_HOTKEYS = [
  { keys: '← / ,', action: 'Back 1 frame' },
  { keys: '→ / .', action: 'Forward 1 frame' },
  { keys: 'Shift+← / Shift+,', action: 'Back 5 frames' },
  { keys: 'Shift+→ / Shift+.', action: 'Forward 5 frames' },
  { keys: 'Num 1 / 2 / 3', action: 'Nudge event on frame back 1 / 3 / 5 frames' },
  { keys: 'Num 4 / 5 / 6', action: 'Nudge event on frame forward 1 / 3 / 5 frames' },
  { keys: 'Space', action: 'Play / pause' },
  { keys: 'F', action: 'Frame play / stop' },
  { keys: 'Enter / M', action: 'Open event picker' },
  { keys: '1–9, 0, Q–T', action: 'Pick event in modal' },
  { keys: 'G', action: 'Toggle magnify' },
  { keys: '1 / 2 / 3', action: 'Magnify zoom 2× / 3× / 4×' },
  { keys: 'Ctrl+S', action: 'Save draft' },
];

const NUMPAD_NUDGE_BY_CODE = {
  Numpad1: -1,
  Numpad2: -3,
  Numpad3: -5,
  Numpad4: 1,
  Numpad5: 3,
  Numpad6: 5,
};

export function getNumpadFrameNudgeDelta(event) {
  if (!event?.code) return null;
  return NUMPAD_NUDGE_BY_CODE[event.code] ?? null;
}

export function getNumpadNudgeLabel(step, direction) {
  const code = direction === 'back'
    ? { 1: 'Num 1', 3: 'Num 2', 5: 'Num 3' }[step]
    : { 1: 'Num 4', 3: 'Num 5', 5: 'Num 6' }[step];
  return code ? `${code} · ${direction === 'back' ? 'Back' : 'Forward'} ${step}` : '';
}

export function isEditableTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}
