import {
  IMAGE_KEYPOINT_LABEL_IDS,
  emptyKeypointsMap,
  countMarkedKeypoints,
} from '../config/imageKeypoints';

export const MIN_AUTO_MARK_REFERENCES = 2;
export const MAX_AUTO_MARK_REFERENCES = 3;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export function isFrameFullyMarked(keypoints) {
  return countMarkedKeypoints(keypoints) >= IMAGE_KEYPOINT_LABEL_IDS.length;
}

function computeAverageDeltaForLabel(referenceIds, keypointsById, label) {
  let dx = 0;
  let dy = 0;
  let n = 0;

  for (let i = 1; i < referenceIds.length; i += 1) {
    const prev = keypointsById[referenceIds[i - 1]]?.keypoints?.[label];
    const curr = keypointsById[referenceIds[i]]?.keypoints?.[label];
    if (!prev || !curr) continue;
    dx += curr.x - prev.x;
    dy += curr.y - prev.y;
    n += 1;
  }

  if (n === 0) return null;
  return { dx: dx / n, dy: dy / n };
}

function sliceLabelableRange(images, fromFrame, toFrame, labelableIds) {
  const start = Math.min(fromFrame, toFrame) - 1;
  const end = Math.max(fromFrame, toFrame) - 1;
  return images
    .slice(start, end + 1)
    .filter((img) => labelableIds.has(String(img._id)));
}

function labelsMarkedOnAllReferences(referenceIds, keypointsById) {
  return IMAGE_KEYPOINT_LABEL_IDS.filter((label) =>
    referenceIds.every((id) => Boolean(keypointsById[id]?.keypoints?.[label]))
  );
}

export function predictLabelInRange({
  images,
  keypointsById,
  label,
  referenceFrom,
  referenceTo,
  targetFrom,
  targetTo,
  labelableIds,
}) {
  const frameCount = images.length;
  if (frameCount === 0) return { error: 'No frames in project' };

  const bounds = [referenceFrom, referenceTo, targetFrom, targetTo];
  if (bounds.some((value) => !Number.isFinite(value) || value < 1 || value > frameCount)) {
    return { error: `Frame numbers must be between 1 and ${frameCount}` };
  }

  const referenceImages = sliceLabelableRange(images, referenceFrom, referenceTo, labelableIds);
  if (referenceImages.length < MIN_AUTO_MARK_REFERENCES) {
    return { error: `Reference range needs at least ${MIN_AUTO_MARK_REFERENCES} labelable frames` };
  }

  const referenceIds = referenceImages.map((img) => String(img._id));
  const targetImages = sliceLabelableRange(images, targetFrom, targetTo, labelableIds);
  if (targetImages.length === 0) {
    return { error: 'Target range has no labelable frames' };
  }

  const labelsToApply = label === 'all' ? labelsMarkedOnAllReferences(referenceIds, keypointsById) : [label];

  if (labelsToApply.length === 0) {
    return { error: 'Selected label is not marked on every reference frame' };
  }

  const updates = {};

  for (const labelId of labelsToApply) {
    const avgDelta = computeAverageDeltaForLabel(referenceIds, keypointsById, labelId);
    if (!avgDelta) {
      return { error: `Need ${labelId} marked on at least ${MIN_AUTO_MARK_REFERENCES} reference frames` };
    }

    const lastRefId = referenceIds[referenceIds.length - 1];
    let current = keypointsById[lastRefId]?.keypoints?.[labelId];
    if (!current) {
      return { error: `Missing ${labelId} on last reference frame` };
    }

    for (const img of targetImages) {
      current = {
        x: clamp01(current.x + avgDelta.dx),
        y: clamp01(current.y + avgDelta.dy),
      };
      if (!updates[img._id]) updates[String(img._id)] = {};
      updates[String(img._id)][labelId] = { ...current };
    }
  }

  return {
    updates,
    frameCount: Object.keys(updates).length,
    labelCount: labelsToApply.length,
  };
}

// Legacy helpers kept for any callers/tests.
export function getCompleteFramesBefore(images, keypointsById, targetId, labelableIds) {
  const targetIndex = images.findIndex((img) => img._id === targetId);
  if (targetIndex <= 0) return [];

  const complete = [];
  for (let i = 0; i < targetIndex; i += 1) {
    const img = images[i];
    if (!labelableIds.has(img._id)) continue;
    const kp = keypointsById[img._id]?.keypoints;
    if (isFrameFullyMarked(kp)) complete.push(img._id);
  }
  return complete;
}

export function computeAverageDeltas(referenceIds, keypointsById) {
  const samples = {};

  for (let i = 1; i < referenceIds.length; i += 1) {
    const prevKp = keypointsById[referenceIds[i - 1]]?.keypoints;
    const currKp = keypointsById[referenceIds[i]]?.keypoints;
    for (const label of IMAGE_KEYPOINT_LABEL_IDS) {
      if (!prevKp?.[label] || !currKp?.[label]) continue;
      if (!samples[label]) samples[label] = { dx: 0, dy: 0, n: 0 };
      samples[label].dx += currKp[label].x - prevKp[label].x;
      samples[label].dy += currKp[label].y - prevKp[label].y;
      samples[label].n += 1;
    }
  }

  const avg = {};
  for (const label of IMAGE_KEYPOINT_LABEL_IDS) {
    if (!samples[label]?.n) continue;
    avg[label] = {
      dx: samples[label].dx / samples[label].n,
      dy: samples[label].dy / samples[label].n,
    };
  }
  return avg;
}

export function predictKeypointsFromReferences(referenceIds, keypointsById) {
  if (referenceIds.length < MIN_AUTO_MARK_REFERENCES) return null;

  const deltaIds = referenceIds.slice(-MAX_AUTO_MARK_REFERENCES);
  const avgDeltas = computeAverageDeltas(deltaIds, keypointsById);
  const lastRefId = referenceIds[referenceIds.length - 1];
  const lastKp = keypointsById[lastRefId]?.keypoints;

  if (!lastKp || !isFrameFullyMarked(lastKp)) return null;

  const predicted = emptyKeypointsMap();
  for (const label of IMAGE_KEYPOINT_LABEL_IDS) {
    const base = lastKp[label];
    const delta = avgDeltas[label];
    if (!base || !delta) return null;
    predicted[label] = {
      x: clamp01(base.x + delta.dx),
      y: clamp01(base.y + delta.dy),
    };
  }

  return isFrameFullyMarked(predicted) ? predicted : null;
}

export function canAutoMarkFrame(images, keypointsById, targetId, labelableIds) {
  const refs = getCompleteFramesBefore(images, keypointsById, targetId, labelableIds);
  return refs.length >= MIN_AUTO_MARK_REFERENCES;
}

export function countAutoMarkReferenceFrames(images, keypointsById, labelableIds) {
  return images.filter(
    (img) => labelableIds.has(img._id) && isFrameFullyMarked(keypointsById[img._id]?.keypoints)
  ).length;
}
