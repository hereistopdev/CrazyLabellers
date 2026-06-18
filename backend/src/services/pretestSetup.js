const fs = require('fs');
const path = require('path');
const VideoAssignment = require('../models/VideoAssignment');
const { CLIP_ID_PATTERN } = require('../utils/exportAnnotation');
const { loadReferenceForClip } = require('./referenceStorage');
const { getVideoDataDir, buildVideoUrl, listStoredClipIds } = require('./videoStorage');

const DEFAULT_PRETEST_COUNT = 3;

async function listClipsWithReference(dataDir = getVideoDataDir()) {
  let clipIds;
  if (fs.existsSync(dataDir)) {
    clipIds = fs
      .readdirSync(dataDir)
      .filter((name) => name.toLowerCase().endsWith('.mp4'))
      .map((name) => name.replace(/\.mp4$/i, ''))
      .filter((clipId) => CLIP_ID_PATTERN.test(clipId));
  } else {
    clipIds = await listStoredClipIds();
  }

  const withReference = [];
  for (const clipId of clipIds) {
    const ref = await loadReferenceForClip(clipId);
    if (ref.hasReference) withReference.push(clipId);
  }
  return withReference.sort();
}

async function setupPretestClips({ pretestCount = DEFAULT_PRETEST_COUNT, dataDir } = {}) {
  const clipIds = await listClipsWithReference(dataDir);
  const pretestClipIds = new Set(clipIds.slice(0, pretestCount));

  let pretestMarked = 0;
  let productionMarked = 0;
  let created = 0;

  for (const clipId of clipIds) {
    const kind = pretestClipIds.has(clipId) ? 'pretest' : 'production';
    let assignment = await VideoAssignment.findOne({ clipId });

    if (!assignment) {
      assignment = await VideoAssignment.create({
        clipId,
        title: kind === 'pretest' ? `Labeling test — ${clipId.slice(0, 8)}` : clipId,
        description:
          kind === 'pretest'
            ? 'Practice labeling test clip scored against reference annotations.'
            : 'Football clip for event labeling',
        videoUrl: buildVideoUrl(clipId),
        gameTime: '1 - 00:00',
        durationSeconds: 30,
        fps: 25,
        kind,
        status: 'available',
        taskPrice: kind === 'pretest' ? 0 : undefined,
      });
      created += 1;
    } else {
      assignment.kind = kind;
      if (kind === 'pretest') {
        assignment.taskPrice = 0;
        assignment.title = assignment.title.startsWith('Labeling test')
          ? assignment.title
          : `Labeling test — ${clipId.slice(0, 8)}`;
        assignment.description =
          'Practice labeling test clip scored against reference annotations.';
      }
      await assignment.save();
    }

    if (kind === 'pretest') pretestMarked += 1;
    else productionMarked += 1;
  }

  await VideoAssignment.updateMany(
    { clipId: { $exists: true, $nin: clipIds } },
    { $set: { kind: 'production' } }
  );

  await VideoAssignment.updateMany({ kind: { $exists: false } }, { $set: { kind: 'production' } });

  return {
    pretestMarked,
    productionMarked,
    created,
    pretestClipIds: [...pretestClipIds],
    totalWithReference: clipIds.length,
  };
}

module.exports = {
  DEFAULT_PRETEST_COUNT,
  listClipsWithReference,
  setupPretestClips,
};
