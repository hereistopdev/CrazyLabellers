import { getUserId } from './userId';
import {
  IMAGE_KEYPOINT_LABEL_IDS,
  emptyKeypointsMap,
  normalizeKeypointsMap,
  keypointsMapToList,
  countMarkedKeypoints,
} from '../config/imageKeypoints';

export function cloneKeypointsCache(cache) {
  const next = {};
  for (const [assignmentId, entry] of Object.entries(cache || {})) {
    const keypoints = emptyKeypointsMap();
    for (const label of IMAGE_KEYPOINT_LABEL_IDS) {
      const point = entry?.keypoints?.[label];
      if (point) keypoints[label] = { x: point.x, y: point.y };
    }
    next[assignmentId] = {
      keypoints,
      status: entry?.status || 'draft',
      reviewerNotes: entry?.reviewerNotes || '',
    };
  }
  return next;
}

const DRAFT_STORAGE_VERSION = 3;

function storageKey(groupId, userId) {
  return `image-kp-draft:v${DRAFT_STORAGE_VERSION}:${userId}:${groupId || 'ungrouped'}`;
}

export function loadImageKeypointDraft(groupId, user) {
  const userId = getUserId(user);
  if (!userId || !groupId) return null;
  try {
    const raw = localStorage.getItem(storageKey(groupId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.images || typeof parsed.images !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveImageKeypointDraft(groupId, user, imagesDraft) {
  const userId = getUserId(user);
  if (!userId || !groupId) return;
  localStorage.setItem(
    storageKey(groupId, userId),
    JSON.stringify({
      groupId,
      userId,
      updatedAt: new Date().toISOString(),
      images: imagesDraft,
    })
  );
}

export function clearImageKeypointDraft(groupId, user) {
  const userId = getUserId(user);
  if (!userId || !groupId) return;
  localStorage.removeItem(storageKey(groupId, userId));
}

export function mergeDraftIntoCache(serverImages, draft) {
  const cache = {};
  for (const image of serverImages || []) {
    const id = String(image._id);
    const draftRow = draft?.images?.[id] || draft?.images?.[image._id];
    const fromServer = normalizeKeypointsMap(image.keypoints || image.keypointsList);
    const localMap = draftRow?.keypoints ? normalizeKeypointsMap(draftRow.keypoints) : null;
    const serverStatus = image.submissionStatus || 'draft';
    const locked = serverStatus === 'submitted' || serverStatus === 'approved';
    const localMarked = localMap ? countMarkedKeypoints(localMap) : 0;
    const serverMarked = countMarkedKeypoints(fromServer);
    const useLocal =
      !locked &&
      localMarked > 0 &&
      (localMarked >= serverMarked || serverMarked === 0);

    cache[id] = {
      keypoints: useLocal ? localMap : fromServer,
      status: locked ? serverStatus : draftRow?.status || serverStatus,
      reviewerNotes: image.reviewerNotes || '',
    };
  }
  return cache;
}

export function cacheToDraftPayload(keypointsById) {
  const images = {};
  for (const [assignmentId, entry] of Object.entries(keypointsById || {})) {
    images[assignmentId] = {
      keypoints: entry.keypoints,
      status: entry.status || 'draft',
    };
  }
  return images;
}

export function draftPayloadToSubmitList(keypointsById) {
  return Object.entries(keypointsById || {}).map(([assignmentId, entry]) => ({
    assignmentId,
    keypointsList: keypointsMapToList(entry.keypoints),
  }));
}
