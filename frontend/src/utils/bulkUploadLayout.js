const DATA_FOLDER = /^data$/i;
const ANNOTATIONS_FOLDER = /^annotations$/i;
const LABELING_FOLDER = /^labeling$/i;
const GENERIC_VIDEO_STEM = /^video$/i;

export function normalizeBulkPath(value) {
  return String(value || '').replace(/\\/g, '/');
}

export function pathParts(relativePath) {
  return normalizeBulkPath(relativePath).split('/').filter(Boolean);
}

export function fileStem(name) {
  return String(name || '').replace(/\.[^.]+$/, '');
}

export function isGenericVideoFilename(name) {
  return GENERIC_VIDEO_STEM.test(fileStem(name));
}

function isInsideFolder(parts, folderPattern) {
  return parts.some((part) => folderPattern.test(part));
}

export function isClipFolderVideoEntry(entry) {
  const { parts, name } = entry;
  if (parts.length !== 2) return false;
  if (isInsideFolder(parts, LABELING_FOLDER)) return false;

  const folderId = sanitizeClipIdFromFolder(parts[0]);
  if (!folderId) return false;

  const videoStemId = sanitizeClipIdFromFolder(fileStem(name));
  return isGenericVideoFilename(name) || folderId !== videoStemId;
}

function sanitizeClipIdFromFolder(value) {
  const stem = String(value || '')
    .trim()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  const clipId = stem.slice(0, 120);
  if (!clipId || clipId.includes('..') || /[\\/]/.test(clipId)) return null;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(clipId)) return null;
  return clipId;
}

export function detectBulkUploadLayout(entries) {
  let hasData = false;
  let hasAnnotations = false;
  let hasLabeling = false;
  let hasClipFolderVideos = false;

  for (const entry of entries) {
    for (const part of entry.parts) {
      if (DATA_FOLDER.test(part)) hasData = true;
      if (ANNOTATIONS_FOLDER.test(part)) hasAnnotations = true;
      if (LABELING_FOLDER.test(part)) hasLabeling = true;
    }
  }

  for (const entry of entries) {
    if (isClipFolderVideoEntry(entry)) {
      hasClipFolderVideos = true;
      break;
    }
  }

  if (hasData || hasAnnotations) return 'data-annotations';
  if (hasLabeling && hasClipFolderVideos) return 'clip-folders';
  if (hasLabeling) return 'group-labeling';
  return 'flat';
}

export function includeBulkVideo(entry, layout, entries) {
  const { parts, name } = entry;
  if (isInsideFolder(parts, LABELING_FOLDER) || isInsideFolder(parts, ANNOTATIONS_FOLDER)) {
    return false;
  }

  if (layout === 'clip-folders') {
    return isClipFolderVideoEntry(entry);
  }

  if (layout === 'data-annotations') {
    const anyDataPath = entries.some((item) => item.parts.some((part) => DATA_FOLDER.test(part)));
    if (anyDataPath) {
      const dataIdx = parts.findIndex((part) => DATA_FOLDER.test(part));
      return dataIdx >= 0 && parts.length === dataIdx + 2;
    }
    return parts.length === 1;
  }

  if (layout === 'group-labeling') {
    if (isInsideFolder(parts, LABELING_FOLDER)) return false;
    if (parts.length === 1) return true;
    if (parts.length === 2) {
      const clipId = sanitizeClipIdFromFolder(fileStem(name));
      return clipId && !isGenericVideoFilename(name);
    }
    return false;
  }

  return true;
}

export function includeBulkJson(entry, layout) {
  const { parts } = entry;

  if (layout === 'clip-folders' || layout === 'group-labeling') {
    const labelingIdx = parts.findIndex((part) => LABELING_FOLDER.test(part));
    return labelingIdx >= 0 && parts.length === labelingIdx + 2;
  }

  if (layout === 'data-annotations') {
    const annotIdx = parts.findIndex((part) => ANNOTATIONS_FOLDER.test(part));
    if (annotIdx >= 0) {
      return parts.length === annotIdx + 2;
    }
    return true;
  }

  return true;
}

export function deriveClipIdFromVideoEntry(video, layout, sanitizeClipId, isSafeClipId) {
  if (layout === 'clip-folders' && video.parts.length >= 2) {
    const folderClipId = sanitizeClipId(video.parts[video.parts.length - 2]);
    if (isSafeClipId(folderClipId)) {
      return folderClipId;
    }
  }

  return sanitizeClipId(video.stem);
}

export function extractGroupNameFromPath(parts, layout, fileType) {
  if (layout !== 'group-labeling') return null;

  const labelingIdx = parts.findIndex((part) => LABELING_FOLDER.test(part));

  if (fileType === 'json' && labelingIdx > 0) {
    return parts[labelingIdx - 1];
  }

  if (fileType === 'video' && labelingIdx < 0 && parts.length >= 2) {
    return parts[parts.length - 2];
  }

  return null;
}

/** JSON stem starts with the full clip ID, then optional _post / _raw suffix. */
export function jsonMatchesClipId(jsonFilename, clipId) {
  const stem = fileStem(jsonFilename).toLowerCase();
  const id = String(clipId || '').toLowerCase();
  if (!id || !stem.startsWith(id)) return false;
  const rest = stem.slice(id.length);
  if (!rest) return true;
  return /^[_-]/.test(rest);
}

export function usesClipIdJsonMatching(layout) {
  return layout === 'group-labeling' || layout === 'clip-folders';
}

export function pickJsonByClipId(clipId, candidates, usedKeys, variant) {
  const pool =
    variant === 'post'
      ? candidates.filter((candidate) => candidate.variant === 'post')
      : candidates.filter((candidate) => candidate.variant !== 'post');

  const matches = pool
    .filter(
      (candidate) =>
        !usedKeys.has(candidate.key) && jsonMatchesClipId(candidate.name, clipId)
    )
    .sort((a, b) => a.name.length - b.name.length);

  if (matches.length === 0) return null;
  return { ...matches[0], score: 1, matchType: 'clipId' };
}
