const {
  LABEL_IDS,
  normalizeKeypoints,
  keypointsMapToArray,
  countMarkedKeypoints,
} = require('../config/imageKeypoints');

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

function getExportFilename(imageId) {
  return `${imageId}.json`;
}

module.exports = {
  buildKeypointExportPayload,
  getExportFilename,
  normalizeKeypoints,
  keypointsMapToArray,
  countMarkedKeypoints,
  REQUIRED_KEYPOINT_COUNT: LABEL_IDS.length,
};
