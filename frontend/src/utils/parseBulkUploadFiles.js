import { MATCH_THRESHOLD, nameSimilarity, classifyJsonVariant, pickBestMatch } from './fuzzyMatch';
import { sanitizeClipId, isSafeClipId, isVideoFilename, isJsonFilename } from './clipId';

export { MATCH_THRESHOLD, nameSimilarity };

function fileStem(name) {
  return String(name || '').replace(/\.[^.]+$/, '');
}

/**
 * Match videos to optional JSON files using 80%+ filename similarity.
 * Videos can use any common extension; JSON is optional.
 */
export function parseBulkUploadFiles(fileList) {
  const fileByName = new Map();
  for (const file of fileList) {
    fileByName.set(file.name, file);
  }

  const videos = [];
  const jsonFiles = [];
  const ignored = [];

  for (const file of fileList) {
    const lower = file.name.toLowerCase();
    if (isVideoFilename(lower)) {
      videos.push({ name: file.name, stem: fileStem(file.name), key: file.name, file });
      continue;
    }
    if (isJsonFilename(lower)) {
      jsonFiles.push({
        name: file.name,
        stem: fileStem(file.name),
        key: file.name,
        file,
        variant: classifyJsonVariant(file.name),
      });
      continue;
    }
    ignored.push({ name: file.name, reason: 'unsupported file type' });
  }

  const usedJson = new Set();
  const clips = [];

  for (const video of videos) {
    const clipId = sanitizeClipId(video.stem);
    if (!isSafeClipId(clipId)) {
      ignored.push({ name: video.name, reason: 'could not derive a safe clip ID' });
      continue;
    }

    const clip = {
      clipId,
      video: video.file,
      postRef: null,
      rawRef: null,
      matches: [],
    };

    const postCandidates = jsonFiles.filter((item) => item.variant === 'post');
    const rawCandidates = jsonFiles.filter((item) => item.variant !== 'post');

    const postMatch = pickBestMatch(video.stem, postCandidates, usedJson, MATCH_THRESHOLD);
    if (postMatch) {
      clip.postRef = postMatch.file;
      usedJson.add(postMatch.key);
      clip.matches.push({ file: postMatch.name, score: postMatch.score, type: 'post' });
    }

    const rawMatch = pickBestMatch(video.stem, rawCandidates, usedJson, MATCH_THRESHOLD);
    if (rawMatch) {
      if (!clip.postRef) {
        clip.postRef = rawMatch.file;
        clip.matches.push({ file: rawMatch.name, score: rawMatch.score, type: 'post-from-json' });
      } else {
        clip.rawRef = rawMatch.file;
        clip.matches.push({ file: rawMatch.name, score: rawMatch.score, type: 'raw' });
      }
      usedJson.add(rawMatch.key);
    }

    clips.push(clip);
  }

  for (const json of jsonFiles) {
    if (usedJson.has(json.key)) continue;
    ignored.push({
      name: json.name,
      reason: 'JSON did not match any video (80%+ name similarity)',
    });
  }

  clips.sort((a, b) => a.clipId.localeCompare(b.clipId));

  return { clips, rejected: ignored, threshold: MATCH_THRESHOLD };
}

export function summarizeBulkUpload(clips, existingClipIds = new Set(), rejected = []) {
  const rejectedVideos = rejected.filter((item) => isVideoFilename(item.name));

  return {
    total: clips.length,
    withPostRef: clips.filter((c) => c.postRef).length,
    withRawRef: clips.filter((c) => c.rawRef).length,
    withoutJson: clips.filter((c) => !c.postRef && !c.rawRef).length,
    alreadyInApp: clips.filter((c) => existingClipIds.has(c.clipId)).length,
    rejectedCount: rejected.length,
    rejectedVideoCount: rejectedVideos.length,
    sampleClipIds: clips.slice(0, 5).map((c) => c.clipId),
    rejectedSamples: rejected.slice(0, 5),
  };
}
