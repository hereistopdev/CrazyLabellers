const { LABEL_IDS } = require('../config/imageKeypoints');

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function parseImageKeypointReference(data) {
  const imageId = String(data?.image || '').trim();
  const width = Number(data?.width);
  const height = Number(data?.height);
  const hasDimensions = Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
  const keypoints = [];

  for (const label of LABEL_IDS) {
    const raw = data?.[label];
    if (raw == null) continue;

    let x;
    let y;

    if (Array.isArray(raw)) {
      if (raw.length < 2) continue;
      x = Number(raw[0]);
      y = Number(raw[1]);
      if (hasDimensions) {
        x /= width;
        y /= height;
      }
    } else if (typeof raw === 'object') {
      x = Number(raw.x);
      y = Number(raw.y);
    } else {
      continue;
    }

    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    keypoints.push({
      label,
      x: clamp01(x),
      y: clamp01(y),
    });
  }

  if (keypoints.length === 0) {
    throw new Error('Reference JSON has no valid keypoints');
  }

  return {
    imageId,
    width: hasDimensions ? width : null,
    height: hasDimensions ? height : null,
    keypoints,
  };
}

module.exports = {
  parseImageKeypointReference,
};
