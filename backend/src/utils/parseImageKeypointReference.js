const { LABEL_IDS } = require('../config/imageKeypoints');
const {
  isLabelMeKeypointJson,
  getLabelMeDimensions,
  getLabelMeImageStem,
  pixelPointFromShape,
} = require('./labelMeKeypointJson');

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function parseFlatKeypointReference(data) {
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

  return {
    imageId: imageId.replace(/\.[^.]+$/, ''),
    width: hasDimensions ? width : null,
    height: hasDimensions ? height : null,
    keypoints,
  };
}

function parseLabelMeKeypointReference(data) {
  const { width, height } = getLabelMeDimensions(data);
  const hasDimensions = Boolean(width && height);
  const imageId = getLabelMeImageStem(data);
  const labelSet = new Set(LABEL_IDS);
  const keypoints = [];

  for (const shape of data.shapes || []) {
    const label = String(shape?.label || '').trim();
    if (!labelSet.has(label)) continue;

    const pixel = pixelPointFromShape(shape);
    if (!pixel) continue;

    let x = pixel.x;
    let y = pixel.y;
    if (hasDimensions) {
      x /= width;
      y /= height;
    }

    keypoints.push({
      label,
      x: clamp01(x),
      y: clamp01(y),
    });
  }

  return {
    imageId,
    width,
    height,
    keypoints,
  };
}

function parseImageKeypointReference(data) {
  if (isLabelMeKeypointJson(data)) {
    return parseLabelMeKeypointReference(data);
  }
  return parseFlatKeypointReference(data);
}

module.exports = {
  parseImageKeypointReference,
  isLabelMeKeypointJson,
};
