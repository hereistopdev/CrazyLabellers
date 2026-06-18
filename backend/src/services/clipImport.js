const fs = require('fs');
const VideoAssignment = require('../models/VideoAssignment');
const { CLIP_ID_PATTERN } = require('../utils/exportAnnotation');
const { getVideoDataDir, buildVideoUrl, listStoredClipIds } = require('./videoStorage');
const { isVpsStorageEnabled } = require('./vpsStorage');

async function importClipsFromDir(dataDir = getVideoDataDir()) {
  let clipIds;
  if (isVpsStorageEnabled()) {
    clipIds = await listStoredClipIds();
  } else {
    if (!fs.existsSync(dataDir)) {
      throw new Error(`VIDEO_DATA_DIR not found: ${dataDir}`);
    }

    clipIds = fs
      .readdirSync(dataDir)
      .filter((name) => name.toLowerCase().endsWith('.mp4'))
      .map((name) => name.replace(/\.mp4$/i, ''))
      .filter((clipId) => CLIP_ID_PATTERN.test(clipId));
  }

  let created = 0;
  let skipped = 0;
  const imported = [];

  for (const clipId of clipIds.sort()) {
    const existing = await VideoAssignment.findOne({ clipId });
    if (existing) {
      skipped += 1;
      continue;
    }

    const assignment = await VideoAssignment.create({
      clipId,
      title: clipId,
      description: 'Football clip for event labeling',
      videoUrl: buildVideoUrl(clipId),
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
    total: clipIds.length,
    imported,
    dataDir: isVpsStorageEnabled() ? process.env.VPS_VIDEO_DIR : dataDir,
  };
}

module.exports = { importClipsFromDir, getVideoDataDir, buildVideoUrl };
