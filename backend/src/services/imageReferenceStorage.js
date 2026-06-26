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
  const storedId = data.image && isSafeClipId(String(data.image).trim()) ? String(data.image).trim() : imageId;
  const keypoints = extractReferenceKeypoints(data);

  fs.writeFileSync(referenceFilePath(storedId), rawString);

  return {
    imageId: storedId,
    width: Number.isFinite(Number(data.width)) ? Number(data.width) : null,
    height: Number.isFinite(Number(data.height)) ? Number(data.height) : null,
    keypoints,
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
  return {
    hasReference: true,
    keypoints,
    width: Number.isFinite(Number(raw.width)) ? Number(raw.width) : null,
    height: Number.isFinite(Number(raw.height)) ? Number(raw.height) : null,
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
