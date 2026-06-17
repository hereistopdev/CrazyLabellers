export const LABELING_HOTKEYS = [
  { keys: '← / ,', action: 'Back 1 frame' },
  { keys: '→ / .', action: 'Forward 1 frame' },
  { keys: 'Shift+← / Shift+,', action: 'Back 5 frames' },
  { keys: 'Shift+→ / Shift+.', action: 'Forward 5 frames' },
  { keys: 'Space', action: 'Play / pause' },
  { keys: 'F', action: 'Frame play / stop' },
  { keys: 'Enter / M', action: 'Open event picker' },
  { keys: '1–9, 0, Q–T', action: 'Pick event in modal' },
  { keys: 'G', action: 'Toggle magnify' },
  { keys: '1 / 2 / 3', action: 'Magnify zoom 2× / 3× / 4×' },
  { keys: 'Ctrl+S', action: 'Save draft' },
];

export function isEditableTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}
