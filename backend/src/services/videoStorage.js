const fs = require('fs');
const path = require('path');
const { isSafeClipId, VIDEO_EXTENSIONS, getVideoExtension, isVideoFilename } = require('../utils/clipId');
const {
  isVpsStorageEnabled,
  uploadVideoToVps,
  deleteVideoFromVps,
  listVpsClipIds,
  testVpsConnection,
} = require('./vpsStorage');

function getVideoDataDir() {
  return process.env.VIDEO_DATA_DIR || path.resolve(__dirname, '..', '..', '..', '..', 'data');
}

function getVideoBaseUrl() {
  if (process.env.VIDEO_BASE_URL?.trim()) {
    return process.env.VIDEO_BASE_URL.trim().replace(/\/$/, '');
  }
  if (process.env.API_BASE_URL?.trim()) {
    return process.env.API_BASE_URL.trim().replace(/\/$/, '');
  }
  const port = process.env.PORT || 5000;
  return `http://localhost:${port}`;
}

function buildVideoUrl(clipId, extension = '.mp4') {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return `${getVideoBaseUrl()}/api/videos/${encodeURIComponent(`${clipId}${ext}`)}`;
}

function isRemoteVideoStorage() {
  return isVpsStorageEnabled();
}

function findLocalVideoPath(clipIdOrFilename) {
  const dataDir = getVideoDataDir();
  const base = path.basename(String(clipIdOrFilename || ''));
  const ext = path.extname(base).toLowerCase();

  if (ext && isVideoFilename(base)) {
    const stem = path.basename(base, ext);
    if (!isSafeClipId(stem)) return null;
    const directPath = path.join(dataDir, base);
    return fs.existsSync(directPath) ? directPath : null;
  }

  if (!isSafeClipId(base)) return null;

  for (const candidateExt of VIDEO_EXTENSIONS) {
    const candidatePath = path.join(dataDir, `${base}${candidateExt}`);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

async function listStoredClipIds() {
  if (isVpsStorageEnabled()) {
    return listVpsClipIds();
  }

  const dataDir = getVideoDataDir();
  if (!fs.existsSync(dataDir)) {
    return [];
  }

  const clipIds = new Set();
  for (const name of fs.readdirSync(dataDir)) {
    if (!isVideoFilename(name)) continue;
    const stem = path.basename(name, path.extname(name));
    if (isSafeClipId(stem)) clipIds.add(stem);
  }

  return [...clipIds].sort();
}

async function storeVideoFile(clipId, file, extension = '.mp4') {
  if (!isSafeClipId(clipId)) {
    throw new Error('Invalid clip ID');
  }

  const ext = extension || getVideoExtension(file.originalname || file.name || '');
  const filename = `${clipId}${ext}`;

  if (isVpsStorageEnabled()) {
    const data = file.buffer || fs.readFileSync(file.path);
    await uploadVideoToVps(clipId, data, ext);
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    return { storage: 'vps', clipId, extension: ext, filename };
  }

  const filePath = path.join(getVideoDataDir(), filename);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (file.path) {
    fs.copyFileSync(file.path, filePath);
    return { storage: 'local', clipId, extension: ext, filename, path: filePath };
  }

  fs.writeFileSync(filePath, file.buffer);
  return { storage: 'local', clipId, extension: ext, filename, path: filePath };
}

async function removeStoredVideoFile(clipId) {
  if (!isSafeClipId(clipId)) return false;

  if (isVpsStorageEnabled()) {
    await deleteVideoFromVps(clipId);
    return true;
  }

  let removed = false;
  for (const ext of VIDEO_EXTENSIONS) {
    const filePath = path.join(getVideoDataDir(), `${clipId}${ext}`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      removed = true;
    }
  }
  return removed;
}

async function getStorageStatus() {
  if (isVpsStorageEnabled()) {
    return testVpsConnection();
  }

  const dataDir = getVideoDataDir();
  const clipIds = await listStoredClipIds();
  return {
    enabled: false,
    ok: true,
    storage: 'local',
    videoDir: dataDir,
    clipCount: clipIds.length,
    videoBaseUrl: getVideoBaseUrl(),
  };
}

module.exports = {
  getVideoDataDir,
  getVideoBaseUrl,
  buildVideoUrl,
  isRemoteVideoStorage,
  findLocalVideoPath,
  listStoredClipIds,
  storeVideoFile,
  removeStoredVideoFile,
  getStorageStatus,
};
