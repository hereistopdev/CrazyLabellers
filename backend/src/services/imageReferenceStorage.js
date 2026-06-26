const fs = require('fs');
const path = require('path');
const ImageAssignment = require('../models/ImageAssignment');
const { isSafeClipId, sanitizeClipId } = require('../utils/clipId');
const { parseImageKeypointReference } = require('../utils/parseImageKeypointReference');
const { getLabelMeDimensions, getLabelMeImageStem } = require('../utils/labelMeKeypointJson');
const { ensureImageDataDir } = require('./imageStorage');

function getReferenceExportFilename(imageId) {
  return `${imageId}.json`;
}

function getImageReferenceDir() {
  const dir =
    process.env.IMAGE_REFERENCE_DIR?.trim() ||
    path.join(ensureImageDataDir(), 'references');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function referenceFilePath(imageId) {
  return path.join(getImageReferenceDir(), getReferenceExportFilename(imageId));
}

function normalizeReferenceStem(value) {
  const stem = path.basename(String(value || ''), path.extname(String(value || '')));
  const sanitized = sanitizeClipId(stem) || stem;
  return sanitized.toLowerCase();
}

function referenceLookupKeys(...values) {
  const keys = new Set();
  for (const value of values) {
    if (!value) continue;
    keys.add(normalizeReferenceStem(value));
    keys.add(String(value).trim().toLowerCase());
  }
  return [...keys].filter(Boolean);
}

function buildReferenceFileLookup(referenceFiles = []) {
  const lookup = new Map();

  for (const file of referenceFiles) {
    const keys = referenceLookupKeys(file.originalname);

    try {
      const parsed = JSON.parse(file.buffer.toString('utf8'));
      keys.push(...referenceLookupKeys(getLabelMeImageStem(parsed)));
      if (parsed?.imagePath) keys.push(...referenceLookupKeys(parsed.imagePath));
      if (parsed?.image) keys.push(...referenceLookupKeys(parsed.image));
    } catch {
      /* ignore invalid JSON here — upload handler will surface parse errors */
    }

    for (const key of keys) {
      if (key) lookup.set(key, file);
    }
  }

  return lookup;
}

function findReferenceFileForImage(referenceLookup, imageId, imageOriginalName) {
  if (!referenceLookup?.size) return null;

  const keys = referenceLookupKeys(
    imageId,
    imageOriginalName,
    path.basename(String(imageOriginalName || ''), path.extname(String(imageOriginalName || '')))
  );

  for (const key of keys) {
    const match = referenceLookup.get(key);
    if (match) return match;
  }

  return null;
}

function getReferenceDimensions(raw, assignment = null) {
  if (raw) {
    const fromJson = getLabelMeDimensions(raw, {});
    if (fromJson.width && fromJson.height) {
      return fromJson;
    }
  }

  return {
    width: assignment?.width ?? null,
    height: assignment?.height ?? null,
  };
}

function parseReferenceJsonObject(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Reference JSON must be an object');
  }
  return data;
}

function parseStoredReferenceJson(raw) {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return null;
  try {
    let cleaned = raw.trim().replace(/^\uFEFF/, '');
    let data = parseReferenceJsonObject(cleaned);
    if (typeof data === 'string') {
      data = parseReferenceJsonObject(data.trim().replace(/^\uFEFF/, ''));
    }
    return data;
  } catch {
    return null;
  }
}

function getReferenceJsonRawString(assignment) {
  const raw = assignment?.referenceJsonRaw;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim().replace(/^\uFEFF/, '');
  }
  return null;
}

function loadReferenceRawJsonFromFile(imageId) {
  if (!isSafeClipId(imageId)) return null;
  const filePath = referenceFilePath(imageId);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return parseStoredReferenceJson(raw);
  } catch {
    return null;
  }
}

function loadReferenceRawJsonForAssignment(assignment) {
  const rawString = getReferenceJsonRawString(assignment);
  if (rawString) {
    const parsed = parseStoredReferenceJson(rawString);
    if (parsed) return parsed;
  }

  return loadReferenceRawJsonFromFile(assignment?.imageId);
}

function hasStoredReferenceForAssignment(assignment) {
  if (parseStoredReferenceJson(getReferenceJsonRawString(assignment))) return true;
  return hasReferenceForImage(assignment?.imageId);
}

function loadReferenceRawJsonForImage(imageId) {
  return loadReferenceRawJsonFromFile(imageId);
}

function extractReferenceKeypoints(data, fallback = {}) {
  try {
    return parseImageKeypointReference(data, fallback).keypoints;
  } catch {
    return [];
  }
}

async function saveReferenceForImage(imageId, rawJson, { sourceFilename = '' } = {}) {
  if (!isSafeClipId(imageId)) {
    throw new Error('Invalid image ID');
  }

  const rawString = typeof rawJson === 'string' ? rawJson.trim().replace(/^\uFEFF/, '') : JSON.stringify(rawJson, null, 2);
  const data = parseReferenceJsonObject(rawString);
  const refDims = getReferenceDimensions(data);
  const parsed = parseImageKeypointReference(
    data,
    refDims.width && refDims.height ? {} : refDims
  );

  fs.writeFileSync(referenceFilePath(imageId), rawString);

  return {
    imageId,
    width: refDims.width || parsed.width,
    height: refDims.height || parsed.height,
    keypoints: parsed.keypoints,
    rawJson: rawString,
    sourceFilename,
  };
}

async function loadReferenceForImage(imageId, assignmentOrFallback = null) {
  const assignment =
    assignmentOrFallback?.imageId || assignmentOrFallback?._id
      ? assignmentOrFallback
      : await ImageAssignment.findOne({ imageId }).select('referenceJsonRaw imageId width height');

  const raw = loadReferenceRawJsonForAssignment(assignment || { imageId });

  if (!raw) {
    return { hasReference: false, keypoints: [], width: null, height: null, raw: null };
  }

  const refDims = getReferenceDimensions(raw, assignment);
  const parsed = parseImageKeypointReference(
    raw,
    refDims.width && refDims.height ? {} : refDims
  );

  return {
    hasReference: parsed.keypoints.length > 0,
    keypoints: parsed.keypoints,
    width: refDims.width || parsed.width,
    height: refDims.height || parsed.height,
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
  if (fs.existsSync(referenceFilePath(imageId))) return true;
  return false;
}

async function syncAssignmentReferenceDimensions(assignment) {
  const raw = loadReferenceRawJsonForAssignment(assignment);
  const refDims = getReferenceDimensions(raw, assignment);
  if (!refDims.width || !refDims.height) return assignment;

  if (assignment.width === refDims.width && assignment.height === refDims.height) {
    return assignment;
  }

  assignment.width = refDims.width;
  assignment.height = refDims.height;
  await assignment.save();
  return assignment;
}

module.exports = {
  getImageReferenceDir,
  buildReferenceFileLookup,
  findReferenceFileForImage,
  saveReferenceForImage,
  loadReferenceForImage,
  loadReferenceRawJsonForImage,
  loadReferenceRawJsonForAssignment,
  getReferenceJsonRawString,
  getReferenceDimensions,
  syncAssignmentReferenceDimensions,
  hasStoredReferenceForAssignment,
  deleteReferenceForImage,
  hasReferenceForImage,
};
