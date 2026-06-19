const VideoAssignment = require('../models/VideoAssignment');
const { isSafeClipId, getVideoExtension } = require('../utils/clipId');
const { isFreeTaskKind, validateTaskPrice, DEFAULT_TASK_PRICE } = require('../config/payments');
const { storeVideoFile, buildVideoUrl } = require('./videoStorage');
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
  clipId: explicitClipId,
  kind = 'production',
  taskPrice,
  skipExisting = true,
  title,
  description,
  gameTime = '1 - 00:00',
  durationSeconds = 30,
  challengeNote = '',
  uploadedBy,
  referenceUpdatedBy,
}) {
  if (!videoFile) {
    throw new Error('Video file is required');
  }

  const clipId = resolveClipId(videoFile.originalname, explicitClipId);
  if (!isSafeClipId(clipId)) {
    throw new Error(`Invalid clip ID derived from filename: ${videoFile.originalname}`);
  }

  const videoExtension = getVideoExtension(videoFile.originalname);

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
    if (refsImported > 0 && referenceUpdatedBy) {
      await VideoAssignment.findByIdAndUpdate(existing._id, {
        referenceUpdatedBy,
        referenceUpdatedAt: new Date(),
      });
    }
    return {
      skipped: true,
      clipId,
      id: existing._id,
      refsImported,
    };
  }

  await storeVideoFile(clipId, videoFile, videoExtension);
  const videoUrl = buildVideoUrl(clipId, videoExtension);

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
        videoUrl,
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
      videoUrl,
      videoExtension,
      uploadedBy,
    });
  }

  let hasReference = false;
  if (await saveReferenceFile(clipId, referencePostFile, 'post')) hasReference = true;
  if (await saveReferenceFile(clipId, referenceRawFile, 'raw')) hasReference = true;

  if (hasReference && referenceUpdatedBy) {
    await VideoAssignment.findByIdAndUpdate(assignment._id, {
      referenceUpdatedBy,
      referenceUpdatedAt: new Date(),
    });
  }

  return {
    skipped: false,
    updated: Boolean(existing),
    clipId,
    id: assignment._id,
    assignment,
    hasReference,
    videoExtension,
  };
}

module.exports = { importClipFromUpload };
