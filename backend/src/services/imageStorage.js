const fs = require('fs');
const path = require('path');
const { isSafeClipId, sanitizeClipId } = require('../utils/clipId');
const {
  isVpsStorageEnabled,
  uploadImageToVps,
  deleteImageFromVps,
  readImageFileFromVps,
} = require('./vpsStorage');

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

function isRemoteImageStorage() {
  return isVpsStorageEnabled();
}

function getImageBaseUrl() {
  if (process.env.IMAGE_BASE_URL?.trim()) {
    return process.env.IMAGE_BASE_URL.trim().replace(/\/$/, '');
  }
  if (isRemoteImageStorage() && process.env.VIDEO_BASE_URL?.trim()) {
    return process.env.VIDEO_BASE_URL.trim().replace(/\/$/, '');
  }
  if (process.env.API_BASE_URL?.trim()) {
    return process.env.API_BASE_URL.trim().replace(/\/$/, '');
  }
  const port = process.env.PORT || 5000;
  return `http://localhost:${port}`;
}

function buildImageUrl(imageId, extension = '.png') {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  const imagePath = `/api/images/${encodeURIComponent(`${imageId}${ext}`)}`;
  if (isRemoteImageStorage()) {
    return `${getImageBaseUrl()}${imagePath}`;
  }
  return imagePath;
}

function normalizeImageUrl(imageUrl) {
  const trimmed = String(imageUrl || '').trim();
  if (!trimmed) return '';

  const pathMatch = trimmed.match(/\/api\/images\/[^?#]+/);
  if (!pathMatch) return trimmed;

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  if (isRemoteImageStorage()) {
    return `${getImageBaseUrl()}${pathMatch[0]}`;
  }

  return pathMatch[0];
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

async function storeImageFile(imageId, fileBuffer, extension = '.png') {
  if (!isSafeClipId(imageId)) {
    throw new Error('Invalid image ID');
  }
  const ext = getImageExtension(`file${extension}`);
  const imageUrl = buildImageUrl(imageId, ext);

  if (isRemoteImageStorage()) {
    await uploadImageToVps(imageId, fileBuffer, ext);
    return { storage: 'vps', extension: ext, imageUrl };
  }

  const dir = ensureImageDataDir();
  const filePath = path.join(dir, `${imageId}${ext}`);
  fs.writeFileSync(filePath, fileBuffer);
  return { storage: 'local', filePath, extension: ext, imageUrl };
}

async function readImageFileFromMediaServer(imageIdOrFilename) {
  const mediaBase = getImageBaseUrl();
  if (!mediaBase || mediaBase.includes('localhost')) return null;

  const base = path.basename(String(imageIdOrFilename || ''));
  if (!base) return null;

  const url = `${mediaBase}/api/images/${encodeURIComponent(base)}`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer.length) return null;

    const ext = path.extname(base).toLowerCase() || '.jpg';
    return { buffer, ext };
  } catch {
    return null;
  }
}

async function loadRemoteImageFile(imageIdOrFilename) {
  const mediaFile = await readImageFileFromMediaServer(imageIdOrFilename);
  if (mediaFile) return mediaFile;

  const mediaBase = getImageBaseUrl();
  if (mediaBase && !mediaBase.includes('localhost')) {
    return null;
  }

  try {
    return await readImageFileFromVps(imageIdOrFilename);
  } catch (error) {
    const message = String(error?.message || error);
    throw new Error(`Failed to load image from VPS: ${message}`);
  }
}

async function deleteImageFile(imageId) {
  if (isRemoteImageStorage()) {
    await deleteImageFromVps(imageId);
    return;
  }

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
  normalizeImageUrl,
  getImageBaseUrl,
  isRemoteImageStorage,
  resolveImageId,
  findLocalImagePath,
  loadRemoteImageFile,
  storeImageFile,
  deleteImageFile,
};
