import { MATCH_THRESHOLD, nameSimilarity, classifyJsonVariant, pickBestMatch, pickJsonByExactStem, isIgnoredBulkJsonName } from './fuzzyMatch';
import { sanitizeClipId, isSafeClipId, isVideoFilename, isJsonFilename } from './clipId';
import {
  detectBulkUploadLayout,
  deriveClipIdFromVideoEntry,
  extractGroupNameFromPath,
  fileStem,
  includeBulkJson,
  includeBulkVideo,
  normalizeBulkPath,
  pathParts,
  pickJsonByClipId,
  usesClipIdJsonMatching,
} from './bulkUploadLayout';

export { MATCH_THRESHOLD, nameSimilarity };

function buildEntries(fileList) {
  const entries = [];

  for (const file of fileList) {
    const relativePath = normalizeBulkPath(file.webkitRelativePath || file.name);
    const parts = pathParts(relativePath);
    const name = parts[parts.length - 1] || file.name;

    entries.push({
      file,
      name,
      relativePath,
      parts,
      key: relativePath,
    });
  }

  return entries;
}

function matchJsonToClip(clipId, videoStem, jsonFiles, usedJson, variant, layout) {
  const candidates = jsonFiles.filter((item) => !isIgnoredBulkJsonName(item.name));

  const exactMatch = pickJsonByExactStem(videoStem, candidates, usedJson, variant);
  if (exactMatch) return exactMatch;

  const clipIdMatch = pickJsonByClipId(clipId, candidates, usedJson, variant);
  if (clipIdMatch) return clipIdMatch;

  if (usesClipIdJsonMatching(layout)) return null;

  const pool =
    variant === 'post'
      ? candidates.filter((item) => item.variant === 'post')
      : candidates.filter((item) => item.variant !== 'post');

  return pickBestMatch(videoStem, pool, usedJson, MATCH_THRESHOLD);
}

/**
 * Match videos to optional JSON files from a selected folder.
 * Supports:
 * - Clip folders: ClipID/video.mkv + labeling/ClipID.json (clip ID from folder name)
 * - Group folder: VideoID.mkv + Labeling/VideoID....json (clip ID prefix match)
 * - Legacy: data/*.mp4 + annotations/*.json (exact stem match per clip)
 * - Nested batches: GroupID/data/*.mkv + GroupID/annotations/*.json
 * - Flat folder: videos + optional JSON at same level
 */
export function parseBulkUploadFiles(fileList) {
  const entries = buildEntries(fileList);
  const layout = detectBulkUploadLayout(entries);

  const videos = [];
  const jsonFiles = [];
  const ignored = [];

  for (const entry of entries) {
    const lower = entry.name.toLowerCase();
    if (isVideoFilename(lower)) {
      if (includeBulkVideo(entry, layout, entries)) {
        videos.push({
          ...entry,
          stem: fileStem(entry.name),
        });
      } else {
        ignored.push({ name: entry.relativePath, reason: 'video in unsupported folder location' });
      }
      continue;
    }

    if (isJsonFilename(lower)) {
      if (isIgnoredBulkJsonName(entry.name)) {
        ignored.push({ name: entry.relativePath, reason: 'legacy _old.json reference skipped' });
        continue;
      }
      if (includeBulkJson(entry, layout)) {
        jsonFiles.push({
          ...entry,
          stem: fileStem(entry.name),
          variant: classifyJsonVariant(entry.name),
        });
      } else {
        ignored.push({ name: entry.relativePath, reason: 'JSON in unsupported folder location' });
      }
      continue;
    }

    ignored.push({ name: entry.relativePath, reason: 'unsupported file type' });
  }

  const usedJson = new Set();
  const clips = [];

  for (const video of videos) {
    const clipId = deriveClipIdFromVideoEntry(video, layout, sanitizeClipId, isSafeClipId);
    if (!isSafeClipId(clipId)) {
      ignored.push({ name: video.relativePath, reason: 'could not derive a safe clip ID' });
      continue;
    }

    const groupName =
      extractGroupNameFromPath(video.parts, layout, 'video') ||
      extractGroupNameFromPath(video.parts, layout, 'json');

    const clip = {
      clipId,
      video: video.file,
      postRef: null,
      rawRef: null,
      groupName,
      matches: [],
    };

    const postMatch = matchJsonToClip(clipId, video.stem, jsonFiles, usedJson, 'post', layout);
    if (postMatch) {
      clip.postRef = postMatch.file;
      usedJson.add(postMatch.key);
      clip.matches.push({ file: postMatch.name, score: postMatch.score, type: 'post' });
      if (!clip.groupName) {
        clip.groupName = extractGroupNameFromPath(postMatch.parts, layout, 'json');
      }
    }

    const rawMatch = matchJsonToClip(clipId, video.stem, jsonFiles, usedJson, 'raw', layout);
    if (rawMatch) {
      if (!clip.postRef) {
        clip.postRef = rawMatch.file;
        clip.matches.push({ file: rawMatch.name, score: rawMatch.score, type: 'post-from-json' });
      } else {
        clip.rawRef = rawMatch.file;
        clip.matches.push({ file: rawMatch.name, score: rawMatch.score, type: 'raw' });
      }
      usedJson.add(rawMatch.key);
      if (!clip.groupName) {
        clip.groupName = extractGroupNameFromPath(rawMatch.parts, layout, 'json');
      }
    }

    clips.push(clip);
  }

  for (const json of jsonFiles) {
    if (usedJson.has(json.key)) continue;
    ignored.push({
      name: json.relativePath,
      reason:
        usesClipIdJsonMatching(layout)
          ? 'JSON filename does not contain a matching video ID'
          : 'JSON did not match any video (clip ID or 80%+ name similarity)',
    });
  }

  clips.sort((a, b) => a.clipId.localeCompare(b.clipId));

  const groupNames = [...new Set(clips.map((clip) => clip.groupName).filter(Boolean))];

  return { clips, rejected: ignored, threshold: MATCH_THRESHOLD, layout, groupNames };
}

export function summarizeBulkUpload(clips, existingClipIds = new Set(), rejected = []) {
  const rejectedVideos = rejected.filter((item) => {
    const name = String(item.name || '').split('/').pop();
    return isVideoFilename(name);
  });
  const groupNames = [...new Set(clips.map((clip) => clip.groupName).filter(Boolean))];

  return {
    total: clips.length,
    withPostRef: clips.filter((c) => c.postRef).length,
    withRawRef: clips.filter((c) => c.rawRef).length,
    withoutJson: clips.filter((c) => !c.postRef && !c.rawRef).length,
    withGroup: clips.filter((c) => c.groupName).length,
    groupCount: groupNames.length,
    groupNames,
    alreadyInApp: clips.filter((c) => existingClipIds.has(c.clipId)).length,
    rejectedCount: rejected.length,
    rejectedVideoCount: rejectedVideos.length,
    sampleClipIds: clips.slice(0, 5).map((c) => c.clipId),
    rejectedSamples: rejected.slice(0, 5),
  };
}
