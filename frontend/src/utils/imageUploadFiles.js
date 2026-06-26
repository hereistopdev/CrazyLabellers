function fileBaseName(file) {
  const rel = file.webkitRelativePath || file.name || '';
  return rel.split(/[/\\]/).pop() || rel;
}

function fileStem(file) {
  const base = fileBaseName(file);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

function isImageFile(file) {
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(fileBaseName(file));
}

function isJsonFile(file) {
  return /\.json$/i.test(fileBaseName(file));
}

export function analyzeImageUploadFiles(files = []) {
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

export function buildImageUploadFormData(files, fields) {
  const { pairs } = analyzeImageUploadFiles(files);
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
