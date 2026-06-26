const { LABEL_IDS } = require('../config/imageKeypoints');
const {
  isLabelMeKeypointJson,
  getLabelMeDimensions,
  getLabelMeImageStem,
  pixelPointFromShape,
  shapePriority,
} = require('./labelMeKeypointJson');

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function resolveReferenceDimensions(data, fallback = {}) {
  const fromJson = getLabelMeDimensions(data, fallback);
  if (fromJson.width && fromJson.height) {
    return fromJson;
  }

  if (fallback.width && fallback.height) {
    return { width: fallback.width, height: fallback.height };
  }

  return { width: null, height: null };
}

function pixelToNormalized(pixel, width, height) {
  if (!pixel) return null;

  let { x, y } = pixel;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const looksNormalized = x >= 0 && x <= 1 && y >= 0 && y <= 1;
  if (looksNormalized && (!width || !height || (width <= 1 && height <= 1))) {
    return { x: clamp01(x), y: clamp01(y) };
  }

  if (width && height) {
    if (x > 1 || y > 1 || width > 1 || height > 1) {
      x /= width;
      y /= height;
    }
    return { x: clamp01(x), y: clamp01(y) };
  }

  if (looksNormalized) {
    return { x: clamp01(x), y: clamp01(y) };
  }

  return null;
}

function parseFlatKeypointReference(data, fallback = {}) {
  const imageId = String(data?.image || '').trim();
  const { width, height } = resolveReferenceDimensions(data, fallback);
  const hasDimensions = Boolean(width && height);
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
    } else if (typeof raw === 'object') {
      x = Number(raw.x);
      y = Number(raw.y);
    } else {
      continue;
    }

    const normalized = pixelToNormalized({ x, y }, hasDimensions ? width : null, hasDimensions ? height : null);
    if (!normalized) continue;

    keypoints.push({
      label,
      x: normalized.x,
      y: normalized.y,
    });
  }

  return {
    imageId: imageId.replace(/\.[^.]+$/, ''),
    width: hasDimensions ? width : null,
    height: hasDimensions ? height : null,
    keypoints,
  };
}

function selectLabelMeShapes(data) {
  const labelSet = new Set(LABEL_IDS);
  const bestByLabel = new Map();

  for (const shape of data?.shapes || []) {
    const label = String(shape?.label || '').trim();
    if (!labelSet.has(label)) continue;

    const priority = shapePriority(shape, label);
    if (priority < 0) continue;

    const existing = bestByLabel.get(label);
    if (!existing || priority > existing.priority) {
      bestByLabel.set(label, { shape, priority });
    }
  }

  return bestByLabel;
}

function parseLabelMeKeypointReference(data, fallback = {}) {
  const { width, height } = resolveReferenceDimensions(data, fallback);
  const hasDimensions = Boolean(width && height);
  const imageId = getLabelMeImageStem(data);
  const bestByLabel = selectLabelMeShapes(data);
  const keypoints = [];

  for (const label of LABEL_IDS) {
    const entry = bestByLabel.get(label);
    if (!entry) continue;

    const pixel = pixelPointFromShape(entry.shape, label);
    if (!pixel) continue;

    const normalized = pixelToNormalized(
      pixel,
      hasDimensions ? width : null,
      hasDimensions ? height : null
    );
    if (!normalized) continue;

    keypoints.push({
      label,
      x: normalized.x,
      y: normalized.y,
    });
  }

  return {
    imageId,
    width,
    height,
    keypoints,
  };
}

function parseImageKeypointReference(data, fallback = {}) {
  if (isLabelMeKeypointJson(data)) {
    return parseLabelMeKeypointReference(data, fallback);
  }
  return parseFlatKeypointReference(data, fallback);
}

module.exports = {
  parseImageKeypointReference,
  isLabelMeKeypointJson,
  resolveReferenceDimensions,
};
