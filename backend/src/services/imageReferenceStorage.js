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

function parseReferenceJsonObject(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Reference JSON must be an object');
  }
  return data;
}

function extractReferenceKeypoints(data) {
  try {
    return parseImageKeypointReference(data).keypoints;
  } catch {
    return [];
  }
}

async function saveReferenceForImage(imageId, rawJson, { sourceFilename = '' } = {}) {
  if (!isSafeClipId(imageId)) {
    throw new Error('Invalid image ID');
  }

  const rawString = typeof rawJson === 'string' ? rawJson : JSON.stringify(rawJson, null, 2);
  const data = parseReferenceJsonObject(rawString);
  const parsed = parseImageKeypointReference(data);
  const storedId =
    parsed.imageId && isSafeClipId(String(parsed.imageId).trim())
      ? String(parsed.imageId).trim()
      : imageId;

  fs.writeFileSync(referenceFilePath(storedId), rawString);

  return {
    imageId: storedId,
    width: parsed.width,
    height: parsed.height,
    keypoints: parsed.keypoints,
    sourceFilename,
  };
}

function loadReferenceRawJsonForImage(imageId) {
  if (!isSafeClipId(imageId)) return null;
  const filePath = referenceFilePath(imageId);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    let data = parseReferenceJsonObject(raw);
    if (typeof data === 'string') {
      data = parseReferenceJsonObject(data);
    }
    return data;
  } catch {
    return null;
  }
}

async function loadReferenceForImage(imageId) {
  const raw = loadReferenceRawJsonForImage(imageId);
  if (!raw) {
    return { hasReference: false, keypoints: [], width: null, height: null, raw: null };
  }

  const keypoints = extractReferenceKeypoints(raw);
  const parsed = parseImageKeypointReference(raw);
  return {
    hasReference: true,
    keypoints,
    width: parsed.width,
    height: parsed.height,
    raw,
  };
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
  loadReferenceRawJsonForImage,
  deleteReferenceForImage,
  hasReferenceForImage,
};
