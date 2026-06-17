const fs = require('fs');
const path = require('path');
const { parseReferenceAnnotation } = require('../utils/parseReferenceAnnotation');
const { CLIP_ID_PATTERN } = require('../utils/exportAnnotation');
const { ensureVideoDataDir } = require('./videoFiles');

function getAnnotationsDir() {
  if (process.env.ANNOTATIONS_DIR) {
    return process.env.ANNOTATIONS_DIR;
  }

  return path.join(path.dirname(ensureVideoDataDir()), 'annotations');
}

function getReferenceFilePath(clipId, variant = 'post') {
  if (!CLIP_ID_PATTERN.test(clipId)) {
    throw new Error('Invalid clip ID');
  }

  const filename = variant === 'post' ? `${clipId}_post.json` : `${clipId}.json`;
  return path.join(getAnnotationsDir(), filename);
}

function loadReferenceForClip(clipId, variant = 'post') {
  const filePath = getReferenceFilePath(clipId, variant);

  if (!fs.existsSync(filePath)) {
    return { hasReference: false, events: [], variant, filePath };
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const events = parseReferenceAnnotation(raw);

  return {
    hasReference: events.length > 0,
    events,
    variant,
    filePath,
    annotationCount: events.length,
  };
}

module.exports = {
  getAnnotationsDir,
  getReferenceFilePath,
  loadReferenceForClip,
};
