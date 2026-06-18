const fs = require('fs');
const path = require('path');
const { parseReferenceAnnotation } = require('../utils/parseReferenceAnnotation');
const { getExportFilename, isValidClipId } = require('../utils/exportAnnotation');
const { isSafeClipId } = require('../utils/clipId');
const { ensureVideoDataDir } = require('./videoFiles');

function getAnnotationsDir() {
  if (process.env.ANNOTATIONS_DIR) {
    return process.env.ANNOTATIONS_DIR;
  }

  return path.join(path.dirname(ensureVideoDataDir()), 'annotations');
}

function getReferenceFilePath(clipId, variant = 'post') {
  if (!isSafeClipId(clipId)) {
    throw new Error('Invalid clip ID');
  }

  const filename = getExportFilename(clipId, variant);
  return path.join(getAnnotationsDir(), filename);
}

function loadReferenceFromFile(clipId, variant = 'post') {
  const filePath = getReferenceFilePath(clipId, variant);

  if (!fs.existsSync(filePath)) {
    return { hasReference: false, events: [], variant, filePath, source: 'file' };
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const events = parseReferenceAnnotation(raw);

  return {
    hasReference: events.length > 0,
    events,
    variant,
    filePath,
    source: 'file',
    annotationCount: events.length,
  };
}

/** @deprecated use referenceStorage.loadReferenceForClip (async) */
function loadReferenceForClip(clipId, variant = 'post') {
  return loadReferenceFromFile(clipId, variant);
}

module.exports = {
  getAnnotationsDir,
  getReferenceFilePath,
  loadReferenceFromFile,
  loadReferenceForClip,
};
