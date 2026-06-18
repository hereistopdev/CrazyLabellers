const fs = require('fs');
const VideoAssignment = require('../models/VideoAssignment');
const { isVideoFilename, isSafeClipId, getVideoExtension } = require('../utils/clipId');
const { getVideoDataDir, buildVideoUrl, listStoredClipIds } = require('./videoStorage');
const { isVpsStorageEnabled } = require('./vpsStorage');

async function importClipsFromDir(dataDir = getVideoDataDir()) {
  let clipEntries = [];

  if (isVpsStorageEnabled()) {
    const clipIds = await listStoredClipIds();
    clipEntries = clipIds.map((clipId) => ({ clipId, extension: '.mp4' }));
  } else {
    if (!fs.existsSync(dataDir)) {
      throw new Error(`VIDEO_DATA_DIR not found: ${dataDir}`);
    }

    clipEntries = fs
      .readdirSync(dataDir)
      .filter((name) => isVideoFilename(name))
      .map((name) => ({
        clipId: name.replace(/(\.[a-z0-9]+)$/i, ''),
        extension: getVideoExtension(name),
      }))
      .filter((entry) => isSafeClipId(entry.clipId));
  }

  let created = 0;
  let skipped = 0;
  const imported = [];

  for (const entry of clipEntries.sort((a, b) => a.clipId.localeCompare(b.clipId))) {
    const { clipId, extension } = entry;
    const existing = await VideoAssignment.findOne({ clipId });
    if (existing) {
      skipped += 1;
      continue;
    }

    const assignment = await VideoAssignment.create({
      clipId,
      title: clipId,
      description: 'Football clip for event labeling',
      videoUrl: buildVideoUrl(clipId, extension),
      gameTime: '1 - 00:00',
      durationSeconds: 30,
      fps: 25,
      status: 'available',
    });
    created += 1;
    imported.push({ clipId, id: assignment._id });
  }

  return {
    created,
    skipped,
    total: clipEntries.length,
    imported,
    dataDir: isVpsStorageEnabled() ? process.env.VPS_VIDEO_DIR : dataDir,
  };
}

module.exports = { importClipsFromDir, getVideoDataDir, buildVideoUrl };
