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
  groupId,
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

  const resolvedGroupId = taskKind === 'production' && groupId ? groupId : null;

  const existing = await VideoAssignment.findOne({ clipId });
  if (existing && skipExisting) {
    let refsImported = 0;
    if (await saveReferenceFile(clipId, referencePostFile, 'post')) refsImported += 1;
    if (await saveReferenceFile(clipId, referenceRawFile, 'raw')) refsImported += 1;

    const skipUpdate = {};
    if (refsImported > 0 && referenceUpdatedBy) {
      skipUpdate.referenceUpdatedBy = referenceUpdatedBy;
      skipUpdate.referenceUpdatedAt = new Date();
    }
    if (resolvedGroupId) {
      skipUpdate.groupId = resolvedGroupId;
    }
    if (Object.keys(skipUpdate).length > 0) {
      await VideoAssignment.findByIdAndUpdate(existing._id, skipUpdate);
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
        ...(resolvedGroupId ? { groupId: resolvedGroupId } : {}),
        ...(taskKind !== 'production' ? { groupId: null } : {}),
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
      groupId: resolvedGroupId,
    });
  }

  let hasReference = false;
  if (await saveReferenceFile(clipId, referencePostFile, 'post')) hasReference = true;
  if (await saveReferenceFile(clipId, referenceRawFile, 'raw')) hasReference = true;

  const postUpdate = {};
  if (hasReference && referenceUpdatedBy) {
    postUpdate.referenceUpdatedBy = referenceUpdatedBy;
    postUpdate.referenceUpdatedAt = new Date();
  }
  if (Object.keys(postUpdate).length > 0) {
    await VideoAssignment.findByIdAndUpdate(assignment._id, postUpdate);
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
