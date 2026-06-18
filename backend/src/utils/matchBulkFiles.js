const path = require('path');
const {
  clipIdFromFilename,
  isJsonFilename,
  isSafeClipId,
  isVideoFilename,
} = require('./clipId');
const { classifyJsonVariant, MATCH_THRESHOLD, nameSimilarity, pickBestMatch } = require('./fuzzyMatch');

function parseFilenameEntry(name) {
  return {
    name,
    stem: path.basename(name, path.extname(name)),
    key: name,
  };
}

function matchBulkFiles(entries, { threshold = MATCH_THRESHOLD } = {}) {
  const videos = [];
  const jsonFiles = [];
  const ignored = [];

  for (const entry of entries) {
    const name = entry.name || entry;
    if (isVideoFilename(name)) {
      videos.push(parseFilenameEntry(name));
      continue;
    }
    if (isJsonFilename(name)) {
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
    const clipId = clipIdFromFilename(video.name);
    if (!isSafeClipId(clipId)) {
      ignored.push({ name: video.name, reason: 'could not derive a safe clip ID' });
      continue;
    }

    const clip = {
      clipId,
      videoName: video.name,
      postRefName: null,
      rawRefName: null,
      matches: [],
    };

    const postCandidates = jsonFiles.filter((item) => item.variant === 'post');
    const rawCandidates = jsonFiles.filter((item) => item.variant !== 'post');

    const postMatch = pickBestMatch(video.stem, postCandidates, usedJson, threshold);
    if (postMatch) {
      clip.postRefName = postMatch.name;
      usedJson.add(postMatch.key);
      clip.matches.push({ file: postMatch.name, score: postMatch.score, type: 'post' });
    }

    const rawMatch = pickBestMatch(video.stem, rawCandidates, usedJson, threshold);
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
    ignored.push({ name: json.name, reason: 'JSON did not match any video (80%+ name similarity)' });
  }

  clips.sort((a, b) => a.clipId.localeCompare(b.clipId));

  return { clips, ignored, threshold };
}

module.exports = {
  matchBulkFiles,
  nameSimilarity,
};
