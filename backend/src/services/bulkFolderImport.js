const fs = require('fs');
const path = require('path');
const VideoAssignment = require('../models/VideoAssignment');
const { matchBulkFiles } = require('../utils/matchBulkFiles');
const { isVideoFilename, getVideoExtension } = require('../utils/clipId');
const { buildVideoUrl, getVideoDataDir } = require('./videoStorage');
const { isFreeTaskKind, validateTaskPrice, DEFAULT_TASK_PRICE } = require('../config/payments');
const { isVpsStorageEnabled, listVpsClipIds, uploadVideoToVps } = require('./vpsStorage');
const { saveReferenceForClip } = require('./referenceStorage');

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

function listEntriesFromDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).map((name) => ({ name, dir }));
}

function listClipMatchesFromLayout(layout) {
  const videoEntries = listEntriesFromDir(layout.dataDir)
    .filter((entry) => isVideoFilename(entry.name))
    .map((entry) => ({ name: entry.name }));

  const jsonEntries = layout.annotationsDir
    ? listEntriesFromDir(layout.annotationsDir)
        .filter((entry) => entry.name.toLowerCase().endsWith('.json'))
        .map((entry) => ({ name: entry.name }))
    : [];

  return matchBulkFiles([...videoEntries, ...jsonEntries]);
}

async function previewBulkFolder(sourceDir) {
  const layout = resolveBulkLayout(sourceDir);
  const { clips, ignored, threshold } = listClipMatchesFromLayout(layout);
  const clipIds = clips.map((clip) => clip.clipId);

  let withPostReference = 0;
  let withRawReference = 0;

  if (layout.annotationsDir) {
    for (const clip of clips) {
      if (clip.postRefName) withPostReference += 1;
      if (clip.rawRefName) withRawReference += 1;
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
    withoutReference: clips.filter((clip) => !clip.postRefName && !clip.rawRefName).length,
    ignoredCount: ignored.length,
    matchThreshold: threshold,
    existingInDb,
    existingOnVps,
    vpsEnabled: isVpsStorageEnabled(),
    sampleClipIds: clipIds.slice(0, 5),
    ignoredSamples: ignored.slice(0, 5),
  };
}

async function importReferencesForClip(clipId, annotationsDir, clipMatch) {
  if (!annotationsDir) {
    return { imported: 0 };
  }

  let imported = 0;

  const importFile = async (filename, variant) => {
    if (!filename) return;
    const filePath = path.join(annotationsDir, filename);
    if (!fs.existsSync(filePath)) return;
    const rawJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    await saveReferenceForClip(clipId, rawJson, {
      variant,
      sourceFilename: filename,
    });
    imported += 1;
  };

  await importFile(clipMatch.postRefName, 'post');
  await importFile(clipMatch.rawRefName, 'raw');

  return { imported };
}

async function uploadVideoFromFolder(clipId, dataDir, videoName, existingVpsClips, skipExistingVideos) {
  const filePath = path.join(dataDir, videoName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Video file missing: ${filePath}`);
  }

  const extension = getVideoExtension(videoName);

  if (isVpsStorageEnabled()) {
    if (skipExistingVideos && existingVpsClips.has(`${clipId}${extension}`)) {
      return { uploaded: false, skipped: true, storage: 'vps', extension };
    }
    await uploadVideoToVps(clipId, filePath, extension);
    existingVpsClips.add(`${clipId}${extension}`);
    return { uploaded: true, skipped: false, storage: 'vps', extension };
  }

  const targetDir = getVideoDataDir();
  fs.mkdirSync(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, `${clipId}${extension}`);
  if (skipExistingVideos && fs.existsSync(targetPath)) {
    return { uploaded: false, skipped: true, storage: 'local', extension };
  }
  fs.copyFileSync(filePath, targetPath);
  return { uploaded: true, skipped: false, storage: 'local', extension };
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
  const { clips: allMatches } = listClipMatchesFromLayout(layout);
  const batch = allMatches.slice(offset, offset + limit);

  const validKinds = ['tutorial', 'pretest', 'production'];
  const taskKind = validKinds.includes(kind) ? kind : 'production';
  const resolvedPrice = isFreeTaskKind(taskKind)
    ? 0
    : taskPrice != null
      ? validateTaskPrice(taskPrice, { kind: taskKind })
      : DEFAULT_TASK_PRICE;

  const existingAssignments = new Set(
    (
      await VideoAssignment.find({ clipId: { $in: batch.map((clip) => clip.clipId) } })
        .select('clipId')
        .lean()
    ).map((row) => row.clipId)
  );

  const existingVpsClips = isVpsStorageEnabled()
    ? new Set(
        (await listVpsClipIds()).flatMap((clipId) =>
          ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v'].map((ext) => `${clipId}${ext}`)
        )
      )
    : new Set();

  let created = 0;
  let skipped = 0;
  let videosUploaded = 0;
  let videosSkipped = 0;
  let referencesImported = 0;
  const errors = [];
  const imported = [];

  for (const clipMatch of batch) {
    const { clipId, videoName } = clipMatch;

    try {
      if (skipExisting && existingAssignments.has(clipId)) {
        skipped += 1;
        if (importReferences && layout.annotationsDir) {
          const refResult = await importReferencesForClip(clipId, layout.annotationsDir, clipMatch);
          referencesImported += refResult.imported;
        }
        continue;
      }

      let extension = getVideoExtension(videoName);
      if (uploadVideos) {
        const uploadResult = await uploadVideoFromFolder(
          clipId,
          layout.dataDir,
          videoName,
          existingVpsClips,
          skipExistingVideos
        );
        extension = uploadResult.extension || extension;
        if (uploadResult.uploaded) videosUploaded += 1;
        if (uploadResult.skipped) videosSkipped += 1;
      }

      if (importReferences && layout.annotationsDir) {
        const refResult = await importReferencesForClip(clipId, layout.annotationsDir, clipMatch);
        referencesImported += refResult.imported;
      }

      const assignment = await VideoAssignment.create({
        clipId,
        title: clipId,
        description: 'Football clip for event labeling',
        videoUrl: buildVideoUrl(clipId, extension),
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
    totalClips: allMatches.length,
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
    nextOffset: nextOffset < allMatches.length ? nextOffset : null,
    done: nextOffset >= allMatches.length,
    kind: taskKind,
    taskPrice: resolvedPrice,
  };
}

module.exports = {
  resolveBulkLayout,
  listClipMatchesFromLayout,
  previewBulkFolder,
  importBulkFromFolder,
};
