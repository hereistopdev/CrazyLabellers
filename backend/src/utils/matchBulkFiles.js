const path = require('path');
const {
  clipIdFromFilename,
  isJsonFilename,
  isSafeClipId,
  isVideoFilename,
} = require('./clipId');
const {
  classifyJsonVariant,
  isIgnoredBulkJsonName,
  MATCH_THRESHOLD,
  pickBestMatch,
  pickJsonByClipId,
  pickJsonByExactStem,
} = require('./fuzzyMatch');

function parseFilenameEntry(entry) {
  const name = entry.name || entry;
  return {
    name,
    stem: path.basename(name, path.extname(name)),
    key: name,
    clipId: entry.clipId || null,
    videoFolder: entry.videoFolder || null,
  };
}

function usesClipIdJsonMatching(layout) {
  return (
    layout === 'group-labeling' ||
    layout === 'clip-folders' ||
    layout === 'data-annotations' ||
    layout === 'nested-clip-batches'
  );
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

function matchBulkFiles(entries, { threshold = MATCH_THRESHOLD, layout = 'flat' } = {}) {
  const videos = [];
  const jsonFiles = [];
  const ignored = [];

  for (const entry of entries) {
    const name = entry.name || entry;
    if (isVideoFilename(name)) {
      videos.push(parseFilenameEntry(entry));
      continue;
    }
    if (isJsonFilename(name)) {
      if (isIgnoredBulkJsonName(name)) {
        ignored.push({ name, reason: 'legacy _old.json reference skipped' });
        continue;
      }
      jsonFiles.push({
        ...parseFilenameEntry(name),
        variant: classifyJsonVariant(name),
      });
      continue;
    }
    ignored.push({ name, reason: 'unsupported file type' });
  }

  const usedJson = new Set();
  const clips = [];

  for (const video of videos) {
    const clipId = video.clipId || clipIdFromFilename(video.name);
    if (!isSafeClipId(clipId)) {
      ignored.push({ name: video.name, reason: 'could not derive a safe clip ID' });
      continue;
    }

    const clip = {
      clipId,
      videoName: video.name,
      videoFolder: video.videoFolder || null,
      postRefName: null,
      rawRefName: null,
      matches: [],
    };

    const postMatch = matchJsonToClip(clipId, video.stem, jsonFiles, usedJson, 'post', layout);
    if (postMatch) {
      clip.postRefName = postMatch.name;
      usedJson.add(postMatch.key);
      clip.matches.push({ file: postMatch.name, score: postMatch.score, type: 'post' });
    }

    const rawMatch = matchJsonToClip(clipId, video.stem, jsonFiles, usedJson, 'raw', layout);
    if (rawMatch) {
      if (!clip.postRefName && rawMatch.variant === 'raw') {
        clip.postRefName = rawMatch.name;
        clip.matches.push({ file: rawMatch.name, score: rawMatch.score, type: 'post-from-json' });
      } else {
        clip.rawRefName = rawMatch.name;
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
      reason:
        usesClipIdJsonMatching(layout)
          ? 'JSON filename does not contain a matching video ID'
          : 'JSON did not match any video (clip ID or 80%+ name similarity)',
    });
  }

  clips.sort((a, b) => a.clipId.localeCompare(b.clipId));

  return { clips, ignored, threshold };
}

module.exports = {
  matchBulkFiles,
};
