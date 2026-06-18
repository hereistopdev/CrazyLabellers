const fs = require('fs');
const path = require('path');
const VideoAssignment = require('../models/VideoAssignment');
const { CLIP_ID_PATTERN } = require('../utils/exportAnnotation');
const { buildVideoUrl, getVideoDataDir } = require('./videoStorage');
const { isVpsStorageEnabled, listVpsClipIds, uploadVideoToVps } = require('./vpsStorage');
const { saveReferenceForClip } = require('./referenceStorage');
const { isFreeTaskKind, validateTaskPrice, DEFAULT_TASK_PRICE } = require('../config/payments');

function resolveBulkLayout(sourceDir) {
  const resolved = path.resolve(sourceDir);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Source folder not found: ${resolved}`);
  }

  const nestedData = path.join(resolved, 'data');
  const nestedAnnotations = path.join(resolved, 'annotations');

  const dataDir = fs.existsSync(nestedData) && fs.statSync(nestedData).isDirectory()
    ? nestedData
    : resolved;

  const annotationsDir =
    fs.existsSync(nestedAnnotations) && fs.statSync(nestedAnnotations).isDirectory()
      ? nestedAnnotations
      : null;

  return { sourceDir: resolved, dataDir, annotationsDir };
}

function listClipIdsFromDataDir(dataDir) {
  if (!fs.existsSync(dataDir)) {
    return [];
  }

  return fs
    .readdirSync(dataDir)
    .filter((name) => name.toLowerCase().endsWith('.mp4'))
    .map((name) => name.replace(/\.mp4$/i, ''))
    .filter((clipId) => CLIP_ID_PATTERN.test(clipId))
    .sort();
}

async function previewBulkFolder(sourceDir) {
  const layout = resolveBulkLayout(sourceDir);
  const clipIds = listClipIdsFromDataDir(layout.dataDir);

  let withPostReference = 0;
  let withRawReference = 0;

  if (layout.annotationsDir) {
    for (const clipId of clipIds) {
      if (fs.existsSync(path.join(layout.annotationsDir, `${clipId}_post.json`))) {
        withPostReference += 1;
      }
      if (fs.existsSync(path.join(layout.annotationsDir, `${clipId}.json`))) {
        withRawReference += 1;
      }
    }
  }

  let existingInDb = 0;
  try {
    existingInDb = await VideoAssignment.countDocuments({ clipId: { $in: clipIds } });
  } catch {
    existingInDb = null;
  }
  let existingOnVps = 0;
  if (isVpsStorageEnabled()) {
    const vpsIds = new Set(await listVpsClipIds());
    existingOnVps = clipIds.filter((id) => vpsIds.has(id)).length;
  }

  return {
    ...layout,
    totalClips: clipIds.length,
    withPostReference,
    withRawReference,
    existingInDb,
    existingOnVps,
    vpsEnabled: isVpsStorageEnabled(),
    sampleClipIds: clipIds.slice(0, 5),
  };
}

async function importReferencesForClip(clipId, annotationsDir) {
  if (!annotationsDir) {
    return { imported: 0 };
  }

  let imported = 0;
  const postPath = path.join(annotationsDir, `${clipId}_post.json`);
  const rawPath = path.join(annotationsDir, `${clipId}.json`);

  if (fs.existsSync(postPath)) {
    const rawJson = JSON.parse(fs.readFileSync(postPath, 'utf8'));
    await saveReferenceForClip(clipId, rawJson, {
      variant: 'post',
      sourceFilename: `${clipId}_post.json`,
    });
    imported += 1;
  }

  if (fs.existsSync(rawPath)) {
    const rawJson = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
    await saveReferenceForClip(clipId, rawJson, {
      variant: 'raw',
      sourceFilename: `${clipId}.json`,
    });
    imported += 1;
  }

  return { imported };
}

async function uploadVideoFromFolder(clipId, dataDir, existingVpsClips, skipExistingVideos) {
  const filePath = path.join(dataDir, `${clipId}.mp4`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Video file missing: ${filePath}`);
  }

  if (isVpsStorageEnabled()) {
    if (skipExistingVideos && existingVpsClips.has(clipId)) {
      return { uploaded: false, skipped: true, storage: 'vps' };
    }
    await uploadVideoToVps(clipId, filePath);
    existingVpsClips.add(clipId);
    return { uploaded: true, skipped: false, storage: 'vps' };
  }

  const targetDir = getVideoDataDir();
  fs.mkdirSync(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, `${clipId}.mp4`);
  if (skipExistingVideos && fs.existsSync(targetPath)) {
    return { uploaded: false, skipped: true, storage: 'local' };
  }
  fs.copyFileSync(filePath, targetPath);
  return { uploaded: true, skipped: false, storage: 'local' };
}

async function importBulkFromFolder({
  sourceDir,
  offset = 0,
  limit = 50,
  uploadVideos = true,
  importReferences = true,
  skipExisting = true,
  skipExistingVideos = true,
  kind = 'production',
  taskPrice,
  continueOnError = true,
} = {}) {
  const layout = resolveBulkLayout(sourceDir);
  const allClipIds = listClipIdsFromDataDir(layout.dataDir);
  const batch = allClipIds.slice(offset, offset + limit);

  const validKinds = ['tutorial', 'pretest', 'production'];
  const taskKind = validKinds.includes(kind) ? kind : 'production';
  const resolvedPrice = isFreeTaskKind(taskKind)
    ? 0
    : taskPrice != null
      ? validateTaskPrice(taskPrice, { kind: taskKind })
      : DEFAULT_TASK_PRICE;

  const existingAssignments = new Set(
    (
      await VideoAssignment.find({ clipId: { $in: batch } })
        .select('clipId')
        .lean()
    ).map((row) => row.clipId)
  );

  const existingVpsClips = isVpsStorageEnabled()
    ? new Set(await listVpsClipIds())
    : new Set();

  let created = 0;
  let skipped = 0;
  let videosUploaded = 0;
  let videosSkipped = 0;
  let referencesImported = 0;
  const errors = [];
  const imported = [];

  for (const clipId of batch) {
    try {
      if (skipExisting && existingAssignments.has(clipId)) {
        skipped += 1;
        if (importReferences && layout.annotationsDir) {
          const refResult = await importReferencesForClip(clipId, layout.annotationsDir);
          referencesImported += refResult.imported;
        }
        continue;
      }

      if (uploadVideos) {
        const uploadResult = await uploadVideoFromFolder(
          clipId,
          layout.dataDir,
          existingVpsClips,
          skipExistingVideos
        );
        if (uploadResult.uploaded) videosUploaded += 1;
        if (uploadResult.skipped) videosSkipped += 1;
      }

      if (importReferences && layout.annotationsDir) {
        const refResult = await importReferencesForClip(clipId, layout.annotationsDir);
        referencesImported += refResult.imported;
      }

      const assignment = await VideoAssignment.create({
        clipId,
        title: clipId,
        description: 'Football clip for event labeling',
        videoUrl: buildVideoUrl(clipId),
        gameTime: '1 - 00:00',
        durationSeconds: 30,
        fps: 25,
        kind: taskKind,
        taskPrice: resolvedPrice,
        status: 'available',
      });

      created += 1;
      imported.push({ clipId, id: assignment._id });
      existingAssignments.add(clipId);
    } catch (error) {
      errors.push({ clipId, message: error.message });
      if (!continueOnError) {
        break;
      }
    }
  }

  const nextOffset = offset + batch.length;
  return {
    sourceDir: layout.sourceDir,
    dataDir: layout.dataDir,
    annotationsDir: layout.annotationsDir,
    totalClips: allClipIds.length,
    offset,
    limit,
    processed: batch.length,
    created,
    skipped,
    videosUploaded,
    videosSkipped,
    referencesImported,
    errors,
    imported,
    nextOffset: nextOffset < allClipIds.length ? nextOffset : null,
    done: nextOffset >= allClipIds.length,
    kind: taskKind,
    taskPrice: resolvedPrice,
  };
}

module.exports = {
  resolveBulkLayout,
  listClipIdsFromDataDir,
  previewBulkFolder,
  importBulkFromFolder,
};
