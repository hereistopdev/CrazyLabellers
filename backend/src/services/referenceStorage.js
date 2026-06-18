const fs = require('fs');
const path = require('path');
const ClipReference = require('../models/ClipReference');
const { parseReferenceAnnotation } = require('../utils/parseReferenceAnnotation');
const { exportAnnotation, getExportFilename, isValidClipId } = require('../utils/exportAnnotation');
const { normalizeLabelEvents } = require('../utils/normalizeLabelEvents');
const { isSafeClipId } = require('../utils/clipId');
const { getAnnotationsDir } = require('./referenceAnnotations');
const { isVpsStorageEnabled, withSftp } = require('./vpsStorage');

function getVpsAnnotationsDir() {
  return process.env.VPS_ANNOTATIONS_DIR?.trim() || '/var/www/football-annotations';
}

function parseReferenceJson(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const events = parseReferenceAnnotation(data);
  if (events.length === 0) {
    throw new Error('Reference JSON has no valid events');
  }
  return events;
}

async function writeReferenceToLocal(clipId, rawJson, variant = 'post') {
  const dir = getAnnotationsDir();
  fs.mkdirSync(dir, { recursive: true });
  const filename = getExportFilename(clipId, variant);
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(rawJson, null, 2));
}

async function writeReferenceToVps(clipId, rawJson, variant = 'post') {
  if (!isVpsStorageEnabled()) return false;

  const filename = getExportFilename(clipId, variant);
  const remoteDir = getVpsAnnotationsDir();
  const remotePath = `${remoteDir}/${filename}`;
  const content = Buffer.from(JSON.stringify(rawJson, null, 2));

  await withSftp(async (sftp) => {
    const exists = await sftp.exists(remoteDir);
    if (!exists) {
      await sftp.mkdir(remoteDir, true);
    }
    await sftp.put(content, remotePath);
  });

  return true;
}

async function saveReferenceEventsForClip(
  clipId,
  events,
  { variant = 'post', gameTime = '1 - 00:00', sourceFilename = 'review-edit' } = {}
) {
  const normalized = normalizeLabelEvents(events);
  if (normalized.length === 0) {
    throw new Error('Reference must have at least one event');
  }

  const rawJson = exportAnnotation(normalized, { gameTime, variant });
  return saveReferenceForClip(clipId, rawJson, { variant, sourceFilename });
}

async function saveReferenceForClip(clipId, rawJson, { variant = 'post', sourceFilename = '' } = {}) {
  if (!isSafeClipId(clipId)) {
    throw new Error('Invalid clip ID');
  }

  const events = parseReferenceJson(rawJson);

  const saved = await ClipReference.findOneAndUpdate(
    { clipId, variant },
    {
      events,
      annotationCount: events.length,
      sourceFilename,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  try {
    await writeReferenceToLocal(clipId, rawJson, variant);
  } catch {
    // local dir may be unavailable on Render — MongoDB is source of truth
  }

  try {
    await writeReferenceToVps(clipId, rawJson, variant);
  } catch {
    // VPS annotation sync is best-effort
  }

  return saved;
}

async function deleteReferenceForClip(clipId, variant = 'post') {
  await ClipReference.deleteMany({ clipId });

  try {
    const dir = getAnnotationsDir();
    for (const v of ['post', 'raw']) {
      const filePath = path.join(dir, getExportFilename(clipId, v));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  } catch {
    // ignore
  }
}

async function hasReferenceForClip(clipId, variant = 'post') {
  const ref = await loadReferenceForClip(clipId, variant);
  return ref.hasReference;
}

async function loadReferenceForClip(clipId, variant = 'post') {
  if (!isSafeClipId(clipId)) {
    return { hasReference: false, events: [], variant, source: 'none' };
  }

  const dbRef = await ClipReference.findOne({ clipId, variant });
  if (dbRef?.events?.length) {
    return {
      hasReference: true,
      events: dbRef.events,
      variant,
      source: 'database',
      annotationCount: dbRef.annotationCount || dbRef.events.length,
    };
  }

  const { loadReferenceFromFile } = require('./referenceAnnotations');
  return loadReferenceFromFile(clipId, variant);
}

module.exports = {
  saveReferenceEventsForClip,
  saveReferenceForClip,
  deleteReferenceForClip,
  hasReferenceForClip,
  loadReferenceForClip,
  parseReferenceJson,
};
