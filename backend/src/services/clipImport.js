const fs = require('fs');
const path = require('path');
const VideoAssignment = require('../models/VideoAssignment');
const { CLIP_ID_PATTERN } = require('../utils/exportAnnotation');

function getVideoDataDir() {
  return process.env.VIDEO_DATA_DIR || path.resolve(__dirname, '..', '..', '..', '..', 'data');
}

function buildVideoUrl(clipId) {
  const port = process.env.PORT || 5000;
  const base = process.env.API_BASE_URL || `http://localhost:${port}`;
  return `${base}/api/videos/${clipId}.mp4`;
}

async function importClipsFromDir(dataDir = getVideoDataDir()) {
  if (!fs.existsSync(dataDir)) {
    throw new Error(`VIDEO_DATA_DIR not found: ${dataDir}`);
  }

  const files = fs
    .readdirSync(dataDir)
    .filter((name) => name.toLowerCase().endsWith('.mp4'))
    .sort();

  let created = 0;
  let skipped = 0;
  const imported = [];

  for (const file of files) {
    const clipId = file.replace(/\.mp4$/i, '');
    if (!CLIP_ID_PATTERN.test(clipId)) {
      skipped += 1;
      continue;
    }

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

  return { created, skipped, total: files.length, imported, dataDir };
}

module.exports = { importClipsFromDir, getVideoDataDir, buildVideoUrl };
