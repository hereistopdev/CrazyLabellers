export const IMAGE_KEYPOINT_LABELS = [
  { id: 'pitch', name: 'Pitch', short: 'P', color: '#22c55e', hint: 'Pitch reference point' },
  { id: 'kp0', name: 'KP0', short: '0', color: '#ef4444', hint: 'Keypoint 0' },
  { id: 'kp1', name: 'KP1', short: '1', color: '#f97316', hint: 'Keypoint 1' },
  { id: 'kp2', name: 'KP2', short: '2', color: '#eab308', hint: 'Keypoint 2' },
  { id: 'kp3', name: 'KP3', short: '3', color: '#84cc16', hint: 'Keypoint 3' },
  { id: 'kp4', name: 'KP4', short: '4', color: '#06b6d4', hint: 'Keypoint 4' },
  { id: 'kp5', name: 'KP5', short: '5', color: '#3b82f6', hint: 'Keypoint 5' },
  { id: 'kp6', name: 'KP6', short: '6', color: '#8b5cf6', hint: 'Keypoint 6' },
  { id: 'kp7', name: 'KP7', short: '7', color: '#ec4899', hint: 'Keypoint 7' },
  { id: 'kp8', name: 'KP8', short: '8', color: '#f43f5e', hint: 'Keypoint 8' },
];

export const IMAGE_KEYPOINT_LABEL_IDS = IMAGE_KEYPOINT_LABELS.map((item) => item.id);
export const LABELLER_EXPORT_LABEL_IDS = IMAGE_KEYPOINT_LABEL_IDS.filter((id) => id.startsWith('kp'));

export function getKeypointLabelMeta(id) {
  return IMAGE_KEYPOINT_LABELS.find((item) => item.id === id) || null;
}

export function normalizedPointToPixels(point, width, height) {
  if (!point || !width || !height) return null;
  return {
    x: Math.round(point.x * width),
    y: Math.round(point.y * height),
  };
}

export function formatKeypointCoords(point, width, height) {
  if (!point) return null;
  const pixels = normalizedPointToPixels(point, width, height);
  const norm = `(${point.x.toFixed(3)}, ${point.y.toFixed(3)})`;
  if (!pixels) return norm;
  return `x: ${pixels.x}, y: ${pixels.y} · ${norm}`;
}

export function labelIdFromHotkey(key, code) {
  const normalized = String(key || '').toLowerCase();
  if (normalized === 'p') return 'pitch';
  if (normalized === '`' || code === 'Backquote') return 'kp0';
  if (/^[0-8]$/.test(normalized)) return `kp${normalized}`;
  return null;
}

export function emptyKeypointsMap() {
  return Object.fromEntries(IMAGE_KEYPOINT_LABEL_IDS.map((id) => [id, null]));
}

export function normalizeKeypointsMap(input = []) {
  const map = emptyKeypointsMap();
  if (input && !Array.isArray(input) && typeof input === 'object') {
    for (const label of IMAGE_KEYPOINT_LABEL_IDS) {
      const point = input[label];
      if (!point) continue;
      const x = Number(point.x);
      const y = Number(point.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      map[label] = { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
    }
    return map;
  }
  for (const item of input || []) {
    const label = String(item?.label || '').trim();
    if (!map.hasOwnProperty(label)) continue;
    const x = Number(item.x);
    const y = Number(item.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    map[label] = { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
  }
  return map;
}

export function countMarkedKeypoints(map) {
  return IMAGE_KEYPOINT_LABEL_IDS.filter((id) => map?.[id]).length;
}

export function countLabellerExportKeypoints(map) {
  return LABELLER_EXPORT_LABEL_IDS.filter((id) => map?.[id]).length;
}

export function keypointsMapToList(map) {
  return IMAGE_KEYPOINT_LABEL_IDS.filter((label) => map?.[label]).map((label) => ({
    label,
    x: map[label].x,
    y: map[label].y,
  }));
}
