import { IMAGE_KEYPOINT_LABEL_IDS } from '../config/imageKeypoints';

export function buildKeypointExportPayload(image, keypoints, dimensions = {}) {
  const width = dimensions.width || image.width || null;
  const height = dimensions.height || image.height || null;
  const payload = {
    image: image.imageId || image.title,
    width,
    height,
  };

  for (const label of IMAGE_KEYPOINT_LABEL_IDS) {
    const point = keypoints?.[label];
    if (!point) continue;
    if (width && height) {
      payload[label] = [Math.round(point.x * width), Math.round(point.y * height)];
    } else {
      payload[label] = [point.x, point.y];
    }
  }

  return payload;
}

export function getKeypointExportFilename(imageId) {
  return `${imageId}.json`;
}

export function downloadJsonFile(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
