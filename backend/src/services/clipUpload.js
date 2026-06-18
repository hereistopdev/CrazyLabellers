const VideoAssignment = require('../models/VideoAssignment');
const { CLIP_ID_PATTERN } = require('../utils/exportAnnotation');
const { isFreeTaskKind, validateTaskPrice, DEFAULT_TASK_PRICE } = require('../config/payments');
const { storeVideoFile } = require('./videoStorage');
const { saveReferenceForClip } = require('./referenceStorage');
const { resolveClipId, createVideoAssignment } = require('./videoFiles');

async function saveReferenceFile(clipId, file, variant) {
  if (!file) {
    return false;
  }
  const rawJson = JSON.parse(file.buffer.toString('utf8'));
  await saveReferenceForClip(clipId, rawJson, {
    variant,
    sourceFilename: file.originalname,
  });
  return true;
}

async function importClipFromUpload({
  videoFile,
  referencePostFile,
  referenceRawFile,
  kind = 'production',
  taskPrice,
  skipExisting = true,
  title,
  description,
  gameTime = '1 - 00:00',
  durationSeconds = 30,
  challengeNote = '',
}) {
  if (!videoFile) {
    throw new Error('Video file is required');
  }

  const clipId = resolveClipId(videoFile.originalname);
  if (!CLIP_ID_PATTERN.test(clipId)) {
    throw new Error(`Invalid clip ID in filename: ${videoFile.originalname}`);
  }

  const validKinds = ['tutorial', 'pretest', 'production'];
  const taskKind = validKinds.includes(kind) ? kind : 'production';
  const resolvedPrice = isFreeTaskKind(taskKind)
    ? 0
    : taskPrice != null
      ? validateTaskPrice(taskPrice, { kind: taskKind })
      : DEFAULT_TASK_PRICE;

  const existing = await VideoAssignment.findOne({ clipId });
  if (existing && skipExisting) {
    let refsImported = 0;
    if (await saveReferenceFile(clipId, referencePostFile, 'post')) refsImported += 1;
    if (await saveReferenceFile(clipId, referenceRawFile, 'raw')) refsImported += 1;
    return {
      skipped: true,
      clipId,
      id: existing._id,
      refsImported,
    };
  }

  await storeVideoFile(clipId, videoFile);

  let assignment;
  if (existing) {
    assignment = await VideoAssignment.findByIdAndUpdate(
      existing._id,
      {
        title: title?.trim() || existing.title || clipId,
        description: description?.trim() || existing.description,
        gameTime: gameTime || existing.gameTime,
        durationSeconds: parseInt(durationSeconds, 10) || existing.durationSeconds || 30,
        kind: taskKind,
        taskPrice: resolvedPrice,
        challengeNote: challengeNote || existing.challengeNote,
      },
      { new: true }
    );
  } else {
    assignment = await createVideoAssignment({
      clipId,
      title: title?.trim() || clipId,
      description: description?.trim() || 'Football clip for event labeling',
      gameTime,
      durationSeconds,
      taskPrice: resolvedPrice,
      challengeNote,
      kind: taskKind,
    });
  }

  let hasReference = false;
  if (await saveReferenceFile(clipId, referencePostFile, 'post')) hasReference = true;
  if (await saveReferenceFile(clipId, referenceRawFile, 'raw')) hasReference = true;

  return {
    skipped: false,
    updated: Boolean(existing),
    clipId,
    id: assignment._id,
    assignment,
    hasReference,
  };
}

module.exports = { importClipFromUpload };
