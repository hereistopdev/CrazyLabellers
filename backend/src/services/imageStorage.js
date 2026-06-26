const fs = require('fs');
const path = require('path');
const { isSafeClipId, sanitizeClipId } = require('../utils/clipId');

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'];
const IMAGE_EXTENSION_SET = new Set(IMAGE_EXTENSIONS.map((ext) => ext.toLowerCase()));

function getImageExtension(filename) {
  const ext = path.extname(String(filename || '')).toLowerCase();
  return IMAGE_EXTENSION_SET.has(ext) ? ext : '.png';
}

function isImageFilename(filename) {
  return IMAGE_EXTENSION_SET.has(path.extname(String(filename || '')).toLowerCase());
}

function ensureImageDataDir() {
  const dir =
    process.env.IMAGE_DATA_DIR || path.resolve(__dirname, '..', '..', '..', '..', 'images');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getImageBaseUrl() {
  if (process.env.API_BASE_URL?.trim()) {
    return process.env.API_BASE_URL.trim().replace(/\/$/, '');
  }
  const port = process.env.PORT || 5000;
  return `http://localhost:${port}`;
}

function buildImageUrl(imageId, extension = '.png') {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return `${getImageBaseUrl()}/api/images/${encodeURIComponent(`${imageId}${ext}`)}`;
}

function resolveImageId(filename, explicitId) {
  const fromName = sanitizeClipId(explicitId || path.basename(filename || '', path.extname(filename || '')));
  if (fromName && isSafeClipId(fromName)) return fromName;
  return null;
}

function findLocalImagePath(imageIdOrFilename) {
  const dataDir = ensureImageDataDir();
  const base = path.basename(String(imageIdOrFilename || ''));
  const ext = path.extname(base).toLowerCase();

  if (ext && isImageFilename(base)) {
    const stem = path.basename(base, ext);
    if (!isSafeClipId(stem)) return null;
    const directPath = path.join(dataDir, base);
    return fs.existsSync(directPath) ? directPath : null;
  }

  if (!isSafeClipId(base)) return null;

  for (const candidateExt of IMAGE_EXTENSIONS) {
    const candidatePath = path.join(dataDir, `${base}${candidateExt}`);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

function storeImageFile(imageId, fileBuffer, extension = '.png') {
  if (!isSafeClipId(imageId)) {
    throw new Error('Invalid image ID');
  }
  const ext = getImageExtension(`file${extension}`);
  const dir = ensureImageDataDir();
  const filePath = path.join(dir, `${imageId}${ext}`);
  fs.writeFileSync(filePath, fileBuffer);
  return { filePath, extension: ext, imageUrl: buildImageUrl(imageId, ext) };
}

function deleteImageFile(imageId) {
  const dataDir = ensureImageDataDir();
  for (const ext of IMAGE_EXTENSIONS) {
    const filePath = path.join(dataDir, `${imageId}${ext}`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

module.exports = {
  IMAGE_EXTENSIONS,
  getImageExtension,
  isImageFilename,
  ensureImageDataDir,
  buildImageUrl,
  resolveImageId,
  findLocalImagePath,
  storeImageFile,
  deleteImageFile,
};
