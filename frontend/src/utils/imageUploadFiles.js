export const MANUAL_IMAGE_GROUP_KEY = '__manual__';

function normalizeImagePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function fileBaseName(file) {
  const rel = file.webkitRelativePath || file.name || '';
  return rel.split(/[/\\]/).pop() || rel;
}

function fileStem(file) {
  const base = fileBaseName(file);
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  return stem.toLowerCase();
}

function pathParts(file) {
  return normalizeImagePath(file.webkitRelativePath || file.name).split('/').filter(Boolean);
}

function isImageFile(file) {
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(fileBaseName(file));
}

function isJsonFile(file) {
  return /\.json$/i.test(fileBaseName(file));
}

function pairImageFiles(files = []) {
  const imageFiles = [];
  const jsonByStem = new Map();

  for (const file of files) {
    if (isJsonFile(file)) {
      jsonByStem.set(fileStem(file), file);
    } else if (isImageFile(file)) {
      imageFiles.push(file);
    }
  }

  const pairs = imageFiles.map((image) => {
    const stem = fileStem(image);
    return {
      stem,
      image,
      json: jsonByStem.get(stem) || null,
    };
  });

  const matchedStems = new Set(pairs.filter((row) => row.json).map((row) => row.stem));
  const unmatchedJson = [...jsonByStem.entries()]
    .filter(([stem]) => !matchedStems.has(stem))
    .map(([, file]) => file);

  return {
    pairs,
    imageFiles,
    jsonFiles: [...jsonByStem.values()],
    imageCount: imageFiles.length,
    jsonCount: jsonByStem.size,
    matchedCount: matchedStems.size,
    unmatchedJsonCount: unmatchedJson.length,
  };
}

function bucketFilesByTopFolder(files = []) {
  const buckets = new Map();

  for (const file of files) {
    const parts = pathParts(file);
    const groupKey = parts.length >= 2 ? parts[0] : MANUAL_IMAGE_GROUP_KEY;
    if (!buckets.has(groupKey)) buckets.set(groupKey, []);
    buckets.get(groupKey).push(file);
  }

  return buckets;
}

export function analyzeImageUploadFiles(files = []) {
  const buckets = bucketFilesByTopFolder(files);
  const usesFolderGroups = [...buckets.keys()].some((key) => key !== MANUAL_IMAGE_GROUP_KEY);

  const groups = [...buckets.entries()].map(([groupKey, groupFiles]) => {
    const pairing = pairImageFiles(groupFiles);
    return {
      groupName: groupKey === MANUAL_IMAGE_GROUP_KEY ? null : groupKey,
      ...pairing,
    };
  });

  const totals = groups.reduce(
    (acc, group) => ({
      imageCount: acc.imageCount + group.imageCount,
      jsonCount: acc.jsonCount + group.jsonCount,
      matchedCount: acc.matchedCount + group.matchedCount,
      unmatchedJsonCount: acc.unmatchedJsonCount + group.unmatchedJsonCount,
    }),
    { imageCount: 0, jsonCount: 0, matchedCount: 0, unmatchedJsonCount: 0 }
  );

  const folderGroups = groups.filter((group) => group.groupName);

  return {
    layout: usesFolderGroups ? 'group-folders' : 'flat',
    groups,
    folderGroups,
    groupCount: folderGroups.length,
    pairs: groups.length === 1 ? groups[0].pairs : groups.flatMap((group) => group.pairs),
    ...totals,
  };
}

export function buildImageUploadFormData(filesOrPairs, fields) {
  const pairs = Array.isArray(filesOrPairs) && filesOrPairs[0]?.image
    ? filesOrPairs
    : pairImageFiles(filesOrPairs).pairs;

  const formData = new FormData();

  for (const pair of pairs) {
    formData.append('images', pair.image, fileBaseName(pair.image));
    if (pair.json) {
      formData.append('references', pair.json, fileBaseName(pair.json));
    }
  }

  for (const [key, value] of Object.entries(fields || {})) {
    if (value != null && value !== '') {
      formData.append(key, value);
    }
  }

  return { formData, pairs };
}
