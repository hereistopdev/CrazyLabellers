const path = require('path');
const { LABELLER_EXPORT_LABEL_IDS } = require('../config/imageKeypoints');

function isLabelMeKeypointJson(data) {
  return Boolean(data && typeof data === 'object' && Array.isArray(data.shapes));
}

function getLabelMeDimensions(data, fallback = {}) {
  const width = Number(data?.imageWidth ?? data?.width ?? fallback.width);
  const height = Number(data?.imageHeight ?? data?.height ?? fallback.height);
  return {
    width: Number.isFinite(width) && width > 0 ? width : null,
    height: Number.isFinite(height) && height > 0 ? height : null,
  };
}

function getLabelMeImageStem(data, fallbackImageId = '') {
  const fromField = String(data?.image || '').trim();
  if (fromField) return fromField.replace(/\.[^.]+$/, '');

  const imagePath = String(data?.imagePath || '').trim();
  if (imagePath) return path.basename(imagePath, path.extname(imagePath));

  return String(fallbackImageId || '').trim();
}

function pixelPointFromShape(shape, label = '') {
  const points = shape?.points;
  if (!Array.isArray(points) || points.length === 0) return null;

  const shapeType = String(shape?.shape_type || '').toLowerCase();
  const labelId = String(label || shape?.label || '').trim();

  if (shapeType === 'point' || (points.length === 1 && Array.isArray(points[0]))) {
    const x = Number(points[0][0]);
    const y = Number(points[0][1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  }

  // kp0–kp8 must come from point shapes only (ignore rectangles / zones)
  if (labelId.startsWith('kp')) {
    return null;
  }

  const first = points.find((point) => Array.isArray(point) && point.length >= 2);
  if (!first) return null;

  const x = Number(first[0]);
  const y = Number(first[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function shapePriority(shape, label) {
  const type = String(shape?.shape_type || '').toLowerCase();
  if (String(label || '').startsWith('kp')) {
    return type === 'point' ? 10 : -1;
  }
  if (type === 'point') return 10;
  if (type === 'rectangle') return 5;
  if (type === 'polygon') return 3;
  return 1;
}

function defaultPointShapeTemplate(existingShapes = []) {
  const template = (existingShapes || []).find(
    (shape) =>
      shape?.shape_type === 'point' &&
      LABELLER_EXPORT_LABEL_IDS.includes(String(shape?.label || '').trim())
  );

  if (template) {
    return JSON.parse(JSON.stringify(template));
  }

  return {
    attributes: {},
    group_id: null,
    description: '',
    shape_type: 'point',
    flags: {},
    mask: null,
  };
}

function buildPointShape(label, pixelPoint, templateSource = []) {
  const shape = defaultPointShapeTemplate(templateSource);
  shape.label = label;
  shape.points = [[pixelPoint[0], pixelPoint[1]]];
  shape.shape_type = 'point';
  return shape;
}

function normalizedToPixelPoint(point, width, height) {
  if (!point || !width || !height) return null;
  return [point.x * width, point.y * height];
}

function mergeLabelMeKeypointExport(referenceRaw, assignment, keypointsMap, labelIds) {
  const base = JSON.parse(JSON.stringify(referenceRaw));
  const { width, height } = getLabelMeDimensions(base, assignment);
  const shapes = Array.isArray(base.shapes) ? base.shapes : [];
  const shapeIndexByLabel = new Map();

  for (let index = 0; index < shapes.length; index += 1) {
    const label = String(shapes[index]?.label || '').trim();
    if (labelIds.includes(label)) {
      shapeIndexByLabel.set(label, index);
    }
  }

  for (const label of labelIds) {
    const point = keypointsMap?.[label];
    if (!point) continue;

    const pixelPoint = normalizedToPixelPoint(point, width, height);
    if (!pixelPoint) continue;

    if (shapeIndexByLabel.has(label)) {
      const shape = shapes[shapeIndexByLabel.get(label)];
      shape.points = [[pixelPoint[0], pixelPoint[1]]];
      shape.shape_type = 'point';
    } else {
      shapes.push(buildPointShape(label, pixelPoint, shapes));
    }
  }

  base.shapes = shapes;
  if (width != null) {
    base.imageWidth = width;
  }
  if (height != null) {
    base.imageHeight = height;
  }
  if (!base.imagePath && assignment?.imageId) {
    const ext = assignment.imageExtension || '.jpg';
    base.imagePath = `${assignment.imageId}${ext.startsWith('.') ? ext : `.${ext}`}`;
  }
  if (base.imageData == null && !Object.prototype.hasOwnProperty.call(base, 'imageData')) {
    base.imageData = null;
  }

  return base;
}

function createMinimalLabelMeExport(assignment, keypointsMap, labelIds) {
  const { width, height } = getLabelMeDimensions({}, assignment);
  const ext = assignment?.imageExtension || '.jpg';
  const imagePath = `${assignment.imageId}${ext.startsWith('.') ? ext : `.${ext}`}`;
  const shapes = [];

  for (const label of labelIds) {
    const point = keypointsMap?.[label];
    if (!point) continue;
    const pixelPoint = normalizedToPixelPoint(point, width, height);
    if (!pixelPoint) continue;
    shapes.push(buildPointShape(label, pixelPoint, shapes));
  }

  return {
    version: '6.3.0',
    flags: {},
    shapes,
    imagePath,
    imageData: null,
    imageWidth: width,
    imageHeight: height,
  };
}

module.exports = {
  isLabelMeKeypointJson,
  getLabelMeDimensions,
  getLabelMeImageStem,
  pixelPointFromShape,
  shapePriority,
  mergeLabelMeKeypointExport,
  createMinimalLabelMeExport,
  normalizedToPixelPoint,
};
