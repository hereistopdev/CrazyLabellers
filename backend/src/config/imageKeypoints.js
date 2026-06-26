const IMAGE_KEYPOINT_LABELS = [
  { id: 'pitch', name: 'Pitch', short: 'P', color: '#22c55e' },
  { id: 'kp0', name: 'KP0', short: '0', color: '#ef4444' },
  { id: 'kp1', name: 'KP1', short: '1', color: '#f97316' },
  { id: 'kp2', name: 'KP2', short: '2', color: '#eab308' },
  { id: 'kp3', name: 'KP3', short: '3', color: '#84cc16' },
  { id: 'kp4', name: 'KP4', short: '4', color: '#06b6d4' },
  { id: 'kp5', name: 'KP5', short: '5', color: '#3b82f6' },
  { id: 'kp6', name: 'KP6', short: '6', color: '#8b5cf6' },
  { id: 'kp7', name: 'KP7', short: '7', color: '#ec4899' },
  { id: 'kp8', name: 'KP8', short: '8', color: '#f43f5e' },
];

const LABEL_IDS = IMAGE_KEYPOINT_LABELS.map((item) => item.id);
const LABEL_ID_SET = new Set(LABEL_IDS);
const LABELLER_EXPORT_LABEL_IDS = LABEL_IDS.filter((id) => id.startsWith('kp'));

function isValidKeypointLabel(label) {
  return LABEL_ID_SET.has(String(label || '').trim());
}

function emptyKeypointsMap() {
  return Object.fromEntries(LABEL_IDS.map((id) => [id, null]));
}

function normalizeKeypoints(input = []) {
  const map = emptyKeypointsMap();

  if (input && !Array.isArray(input) && typeof input === 'object') {
    for (const label of LABEL_IDS) {
      const point = input[label];
      if (!point) continue;
      const x = Number(point.x);
      const y = Number(point.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      map[label] = {
        x: Math.min(1, Math.max(0, x)),
        y: Math.min(1, Math.max(0, y)),
      };
    }
    return map;
  }

  for (const item of input || []) {
    const label = String(item?.label || '').trim();
    if (!isValidKeypointLabel(label)) continue;
    const x = Number(item.x);
    const y = Number(item.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    map[label] = {
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    };
  }
  return map;
}

function keypointsMapToArray(map) {
  return LABEL_IDS.filter((label) => map?.[label]).map((label) => ({
    label,
    x: map[label].x,
    y: map[label].y,
  }));
}

function countMarkedKeypoints(map) {
  return LABEL_IDS.filter((label) => map?.[label]).length;
}

function countLabellerExportKeypoints(map) {
  return LABELLER_EXPORT_LABEL_IDS.filter((label) => map?.[label]).length;
}

module.exports = {
  IMAGE_KEYPOINT_LABELS,
  LABEL_IDS,
  LABELLER_EXPORT_LABEL_IDS,
  isValidKeypointLabel,
  emptyKeypointsMap,
  normalizeKeypoints,
  keypointsMapToArray,
  countMarkedKeypoints,
  countLabellerExportKeypoints,
};
