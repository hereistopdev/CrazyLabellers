const fs = require('fs');
const path = require('path');
const { isSafeClipId } = require('../utils/clipId');
const { getExportFilename } = require('../utils/imageKeypointExport');
const { parseImageKeypointReference } = require('../utils/parseImageKeypointReference');
const { ensureImageDataDir } = require('./imageStorage');

function getImageReferenceDir() {
  const dir =
    process.env.IMAGE_REFERENCE_DIR?.trim() ||
    path.join(ensureImageDataDir(), 'references');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function referenceFilePath(imageId) {
  return path.join(getImageReferenceDir(), getExportFilename(imageId));
}

function parseReferenceJson(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return parseImageKeypointReference(data);
}

async function saveReferenceForImage(imageId, rawJson, { sourceFilename = '' } = {}) {
  if (!isSafeClipId(imageId)) {
    throw new Error('Invalid image ID');
  }

  const parsed = parseReferenceJson(rawJson);
  const storedId = parsed.imageId && isSafeClipId(parsed.imageId) ? parsed.imageId : imageId;

  fs.writeFileSync(referenceFilePath(storedId), JSON.stringify(rawJson, null, 2));

  return {
    imageId: storedId,
    width: parsed.width,
    height: parsed.height,
    keypoints: parsed.keypoints,
    sourceFilename,
  };
}

async function loadReferenceForImage(imageId) {
  if (!isSafeClipId(imageId)) {
    return { hasReference: false, keypoints: [], width: null, height: null };
  }

  const filePath = referenceFilePath(imageId);
  if (!fs.existsSync(filePath)) {
    return { hasReference: false, keypoints: [], width: null, height: null };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = parseReferenceJson(raw);
    return {
      hasReference: true,
      keypoints: parsed.keypoints,
      width: parsed.width,
      height: parsed.height,
    };
  } catch {
    return { hasReference: false, keypoints: [], width: null, height: null };
  }
}

function deleteReferenceForImage(imageId) {
  if (!isSafeClipId(imageId)) return;
  const filePath = referenceFilePath(imageId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function hasReferenceForImage(imageId) {
  if (!isSafeClipId(imageId)) return false;
  return fs.existsSync(referenceFilePath(imageId));
}

module.exports = {
  getImageReferenceDir,
  saveReferenceForImage,
  loadReferenceForImage,
  deleteReferenceForImage,
  hasReferenceForImage,
};
