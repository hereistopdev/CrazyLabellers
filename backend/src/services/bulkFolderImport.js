const fs = require('fs');
const path = require('path');
const VideoAssignment = require('../models/VideoAssignment');
const { matchBulkFiles } = require('../utils/matchBulkFiles');
const { isVideoFilename, getVideoExtension, clipIdFromFilename, isSafeClipId } = require('../utils/clipId');
const { buildVideoUrl, getVideoDataDir } = require('./videoStorage');
const { isFreeTaskKind, validateTaskPrice, DEFAULT_TASK_PRICE } = require('../config/payments');
const { isVpsStorageEnabled, listVpsClipIds, uploadVideoToVps } = require('./vpsStorage');
const { saveReferenceForClip } = require('./referenceStorage');

function findCaseInsensitiveSubdir(parentDir, folderPattern) {
  if (!fs.existsSync(parentDir)) return null;
  for (const name of fs.readdirSync(parentDir)) {
    const full = path.join(parentDir, name);
    if (folderPattern.test(name) && fs.statSync(full).isDirectory()) {
      return full;
    }
  }
  return null;
}

function listVideosFromDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => {
      const filePath = path.join(dir, name);
      return fs.statSync(filePath).isFile() && isVideoFilename(name);
    })
    .map((name) => ({ name }));
}

function listNestedClipBatchEntries(sourceDir) {
  const entries = [];
  const jsonEntries = [];

  for (const subName of fs.readdirSync(sourceDir)) {
    const subPath = path.join(sourceDir, subName);
    if (!fs.statSync(subPath).isDirectory()) continue;
    if (/^labeling$/i.test(subName)) continue;

    const annotationsDir = findCaseInsensitiveSubdir(subPath, /^annotations$/i);
    const dataDir = findCaseInsensitiveSubdir(subPath, /^data$/i);

    const videoDir = dataDir || subPath;
    const videos = listVideosFromDir(videoDir);
    for (const video of videos) {
      entries.push({ name: video.name });
    }

    if (annotationsDir) {
      for (const json of listEntriesFromDir(annotationsDir)) {
        if (json.name.toLowerCase().endsWith('.json')) {
          jsonEntries.push({ name: json.name });
        }
      }
    }
  }

  return { videoEntries: entries, jsonEntries };
}

function hasNestedClipBatchFolders(sourceDir) {
  return fs.readdirSync(sourceDir).some((subName) => {
    const subPath = path.join(sourceDir, subName);
    if (!fs.statSync(subPath).isDirectory()) return false;
    if (/^labeling$/i.test(subName)) return false;

    const annotationsDir = findCaseInsensitiveSubdir(subPath, /^annotations$/i);
    if (!annotationsDir) return false;

    const dataDir = findCaseInsensitiveSubdir(subPath, /^data$/i);
    const rootVideos = listVideosFromDir(subPath);
    const dataVideos = dataDir ? listVideosFromDir(dataDir) : [];
    return rootVideos.length > 0 || dataVideos.length > 0;
  });
}

function findNestedVideoFile(sourceDir, videoName) {
  if (!sourceDir || !videoName) return null;
  for (const subName of fs.readdirSync(sourceDir)) {
    const subPath = path.join(sourceDir, subName);
    if (!fs.statSync(subPath).isDirectory()) continue;
    if (/^labeling$/i.test(subName)) continue;

    const dataDir = findCaseInsensitiveSubdir(subPath, /^data$/i);
    const candidates = [dataDir, subPath].filter(Boolean);
    for (const dir of candidates) {
      const filePath = path.join(dir, videoName);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return filePath;
      }
    }
  }
  return null;
}

function findNestedAnnotationFile(sourceDir, filename) {
  if (!sourceDir || !filename) return null;
  for (const subName of fs.readdirSync(sourceDir)) {
    const subPath = path.join(sourceDir, subName);
    if (!fs.statSync(subPath).isDirectory()) continue;
    const annotationsDir = findCaseInsensitiveSubdir(subPath, /^annotations$/i);
    if (!annotationsDir) continue;
    const filePath = path.join(annotationsDir, filename);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return filePath;
    }
  }
  return null;
}

function resolveBulkLayout(sourceDir) {
  const resolved = path.resolve(sourceDir);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Source folder not found: ${resolved}`);
  }

  const labelingDir = findCaseInsensitiveSubdir(resolved, /^labeling$/i);

  if (labelingDir) {
    const hasClipFolderVideos = fs.readdirSync(resolved).some((name) => {
      const full = path.join(resolved, name);
      if (!fs.statSync(full).isDirectory()) return false;
      if (/^labeling$/i.test(name)) return false;
      if (!isSafeClipId(clipIdFromFilename(name))) return false;
      return fs.readdirSync(full).some((fileName) => {
        const filePath = path.join(full, fileName);
        return fs.statSync(filePath).isFile() && isVideoFilename(fileName);
      });
    });

    if (hasClipFolderVideos) {
      return {
        sourceDir: resolved,
        dataDir: resolved,
        annotationsDir: labelingDir,
        groupName: null,
        layout: 'clip-folders',
      };
    }
  }

  const hasVideosAtRoot = fs.readdirSync(resolved).some((name) => {
    const full = path.join(resolved, name);
    return fs.statSync(full).isFile() && isVideoFilename(name);
  });

  if (labelingDir && hasVideosAtRoot) {
    return {
      sourceDir: resolved,
      dataDir: resolved,
      annotationsDir: labelingDir,
      groupName: path.basename(resolved),
      layout: 'group-labeling',
    };
  }

  const nestedData = path.join(resolved, 'data');
  const nestedAnnotations = path.join(resolved, 'annotations');

  if (hasNestedClipBatchFolders(resolved)) {
    return {
      sourceDir: resolved,
      dataDir: resolved,
      annotationsDir: null,
      groupName: path.basename(resolved),
      layout: 'nested-clip-batches',
    };
  }

  const dataDir = fs.existsSync(nestedData) && fs.statSync(nestedData).isDirectory()
    ? nestedData
    : resolved;

  const annotationsDir =
    fs.existsSync(nestedAnnotations) && fs.statSync(nestedAnnotations).isDirectory()
      ? nestedAnnotations
      : null;

  return {
    sourceDir: resolved,
    dataDir,
    annotationsDir,
    groupName: null,
    layout: annotationsDir || nestedData !== resolved ? 'data-annotations' : 'flat',
  };
}

function listEntriesFromDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).map((name) => ({ name, dir }));
}

function listClipFolderVideoEntries(sourceDir) {
  const entries = [];

  for (const dirName of fs.readdirSync(sourceDir)) {
    const dirPath = path.join(sourceDir, dirName);
    if (!fs.statSync(dirPath).isDirectory()) continue;
    if (/^labeling$/i.test(dirName)) continue;

    const clipId = clipIdFromFilename(dirName);
    if (!isSafeClipId(clipId)) continue;

    for (const fileName of fs.readdirSync(dirPath)) {
      const filePath = path.join(dirPath, fileName);
      if (!fs.statSync(filePath).isFile() || !isVideoFilename(fileName)) continue;
      entries.push({ name: fileName, clipId, videoFolder: dirName });
      break;
    }
  }

  return entries;
}

function listClipMatchesFromLayout(layout) {
  if (layout.layout === 'nested-clip-batches') {
    const { videoEntries, jsonEntries } = listNestedClipBatchEntries(layout.sourceDir);
    return matchBulkFiles([...videoEntries, ...jsonEntries], { layout: layout.layout });
  }

  const jsonEntries = layout.annotationsDir
    ? listEntriesFromDir(layout.annotationsDir)
        .filter((entry) => entry.name.toLowerCase().endsWith('.json'))
        .map((entry) => ({ name: entry.name }))
    : [];

  if (layout.layout === 'clip-folders') {
    const videoEntries = listClipFolderVideoEntries(layout.sourceDir);
    return matchBulkFiles([...videoEntries, ...jsonEntries], { layout: layout.layout });
  }

  const videoEntries = listEntriesFromDir(layout.dataDir)
    .filter((entry) => isVideoFilename(entry.name))
    .map((entry) => ({ name: entry.name }));

  return matchBulkFiles([...videoEntries, ...jsonEntries], { layout: layout.layout || 'flat' });
}

async function previewBulkFolder(sourceDir) {
  const layout = resolveBulkLayout(sourceDir);
  const { clips, ignored, threshold } = listClipMatchesFromLayout(layout);
  const clipIds = clips.map((clip) => clip.clipId);

  let withPostReference = 0;
  let withRawReference = 0;

  if (layout.annotationsDir || layout.layout === 'nested-clip-batches') {
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

async function importReferencesForClip(clipId, annotationsDir, clipMatch, sourceDir = null) {
  if (!annotationsDir && !sourceDir) {
    return { imported: 0 };
  }

  let imported = 0;

  const importFile = async (filename, variant) => {
    if (!filename) return;
    const filePath = annotationsDir
      ? path.join(annotationsDir, filename)
      : findNestedAnnotationFile(sourceDir, filename);
    if (!filePath || !fs.existsSync(filePath)) return;
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

async function uploadVideoFromFolder(
  clipId,
  dataDir,
  videoName,
  existingVpsClips,
  skipExistingVideos,
  videoFolder = null
) {
  const filePath = videoFolder
    ? path.join(dataDir, videoFolder, videoName)
    : path.join(dataDir, videoName);
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
  uploadedBy,
  referenceUpdatedBy,
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
        if (importReferences && (layout.annotationsDir || layout.layout === 'nested-clip-batches')) {
          const refResult = await importReferencesForClip(
            clipId,
            layout.annotationsDir,
            clipMatch,
            layout.layout === 'nested-clip-batches' ? layout.sourceDir : null
          );
          referencesImported += refResult.imported;
          if (refResult.imported > 0 && referenceUpdatedBy) {
            await VideoAssignment.updateOne(
              { clipId },
              { referenceUpdatedBy, referenceUpdatedAt: new Date() }
            );
          }
        }
        continue;
      }

      let extension = getVideoExtension(videoName);
      if (uploadVideos) {
        let uploadResult;
        if (layout.layout === 'nested-clip-batches') {
          const nestedPath = findNestedVideoFile(layout.sourceDir, videoName);
          if (!nestedPath) {
            throw new Error(`Video file missing for ${clipId}: ${videoName}`);
          }
          extension = getVideoExtension(videoName);
          if (isVpsStorageEnabled()) {
            if (skipExistingVideos && existingVpsClips.has(`${clipId}${extension}`)) {
              uploadResult = { uploaded: false, skipped: true, extension };
            } else {
              await uploadVideoToVps(clipId, nestedPath, extension);
              existingVpsClips.add(`${clipId}${extension}`);
              uploadResult = { uploaded: true, skipped: false, extension };
            }
          } else {
            const targetDir = getVideoDataDir();
            fs.mkdirSync(targetDir, { recursive: true });
            const targetPath = path.join(targetDir, `${clipId}${extension}`);
            if (skipExistingVideos && fs.existsSync(targetPath)) {
              uploadResult = { uploaded: false, skipped: true, extension };
            } else {
              fs.copyFileSync(nestedPath, targetPath);
              uploadResult = { uploaded: true, skipped: false, extension };
            }
          }
        } else {
          uploadResult = await uploadVideoFromFolder(
            clipId,
            layout.dataDir,
            videoName,
            existingVpsClips,
            skipExistingVideos,
            clipMatch.videoFolder
          );
        }
        extension = uploadResult.extension || extension;
        if (uploadResult.uploaded) videosUploaded += 1;
        if (uploadResult.skipped) videosSkipped += 1;
      }

      let refsForClip = 0;
      if (importReferences && (layout.annotationsDir || layout.layout === 'nested-clip-batches')) {
        const refResult = await importReferencesForClip(
          clipId,
          layout.annotationsDir,
          clipMatch,
          layout.layout === 'nested-clip-batches' ? layout.sourceDir : null
        );
        referencesImported += refResult.imported;
        refsForClip = refResult.imported;
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
        uploadedBy: uploadedBy || null,
        referenceUpdatedBy: refsForClip > 0 && referenceUpdatedBy ? referenceUpdatedBy : null,
        referenceUpdatedAt: refsForClip > 0 && referenceUpdatedBy ? new Date() : null,
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
