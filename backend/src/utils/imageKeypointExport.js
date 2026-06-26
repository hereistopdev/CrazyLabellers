const {
  LABEL_IDS,
  LABELLER_EXPORT_LABEL_IDS,
  normalizeKeypoints,
  keypointsMapToArray,
  countMarkedKeypoints,
  countLabellerExportKeypoints,
} = require('../config/imageKeypoints');
const {
  isLabelMeKeypointJson,
  mergeLabelMeKeypointExport,
  createMinimalLabelMeExport,
} = require('./labelMeKeypointJson');

function buildKeypointExportPayload(assignment, keypoints, dimensions = {}) {
  const map = normalizeKeypoints(keypoints);
  const width = dimensions.width || assignment.width || null;
  const height = dimensions.height || assignment.height || null;

  const payload = {
    image: assignment.imageId,
    width,
    height,
  };

  for (const label of LABEL_IDS) {
    if (!map[label]) continue;
    if (width && height) {
      payload[label] = [
        Math.round(map[label].x * width),
        Math.round(map[label].y * height),
      ];
    } else {
      payload[label] = [map[label].x, map[label].y];
    }
  }

  return payload;
}

function buildMergedKeypointExportPayload(assignment, keypoints, referenceRaw = null) {
  const map = normalizeKeypoints(keypoints);

  if (referenceRaw && isLabelMeKeypointJson(referenceRaw)) {
    return mergeLabelMeKeypointExport(
      referenceRaw,
      assignment,
      map,
      LABELLER_EXPORT_LABEL_IDS
    );
  }

  if (!referenceRaw) {
    return createMinimalLabelMeExport(assignment, map, LABELLER_EXPORT_LABEL_IDS);
  }

  const base =
    typeof referenceRaw === 'object' && !Array.isArray(referenceRaw)
      ? JSON.parse(JSON.stringify(referenceRaw))
      : {
          image: assignment.imageId,
          width: assignment.width ?? null,
          height: assignment.height ?? null,
        };

  const width = base.width || assignment.width || null;
  const height = base.height || assignment.height || null;

  if (!base.image) base.image = assignment.imageId;
  if (width != null) base.width = width;
  if (height != null) base.height = height;

  for (const label of LABELLER_EXPORT_LABEL_IDS) {
    if (!map[label]) continue;
    if (width && height) {
      base[label] = [
        Math.round(map[label].x * width),
        Math.round(map[label].y * height),
      ];
    } else {
      base[label] = [map[label].x, map[label].y];
    }
  }

  return base;
}

function getExportFilename(imageId) {
  return `${imageId}.json`;
}

module.exports = {
  buildKeypointExportPayload,
  buildMergedKeypointExportPayload,
  getExportFilename,
  normalizeKeypoints,
  keypointsMapToArray,
  countMarkedKeypoints,
  countLabellerExportKeypoints,
  LABELLER_EXPORT_LABEL_IDS,
  REQUIRED_KEYPOINT_COUNT: LABEL_IDS.length,
};
