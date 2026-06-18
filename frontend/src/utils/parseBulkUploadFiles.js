const CLIP_ID_PATTERN = /^[a-f0-9]{30}$/i;

/**
 * Group folder-selected files into clips: one .mp4 plus optional reference JSON.
 * Supports layouts like data/clip.mp4 and annotations/clip_post.json.
 */
export function parseBulkUploadFiles(fileList) {
  const clips = new Map();

  const ensureClip = (clipId) => {
    if (!CLIP_ID_PATTERN.test(clipId)) {
      return null;
    }
    if (!clips.has(clipId)) {
      clips.set(clipId, { clipId, video: null, postRef: null, rawRef: null });
    }
    return clips.get(clipId);
  };

  for (const file of fileList) {
    const lower = file.name.toLowerCase();

    if (lower.endsWith('.mp4')) {
      const clipId = file.name.replace(/\.mp4$/i, '');
      const clip = ensureClip(clipId);
      if (clip) clip.video = file;
      continue;
    }

    if (lower.endsWith('_post.json')) {
      const clipId = file.name.replace(/_post\.json$/i, '');
      const clip = ensureClip(clipId);
      if (clip) clip.postRef = file;
      continue;
    }

    if (lower.endsWith('.json')) {
      const clipId = file.name.replace(/\.json$/i, '');
      const clip = ensureClip(clipId);
      if (clip) clip.rawRef = file;
    }
  }

  return [...clips.values()]
    .filter((clip) => clip.video)
    .sort((a, b) => a.clipId.localeCompare(b.clipId));
}

export function summarizeBulkUpload(clips, existingClipIds = new Set()) {
  return {
    total: clips.length,
    withPostRef: clips.filter((c) => c.postRef).length,
    withRawRef: clips.filter((c) => c.rawRef).length,
    alreadyInApp: clips.filter((c) => existingClipIds.has(c.clipId)).length,
    sampleClipIds: clips.slice(0, 5).map((c) => c.clipId),
  };
}
