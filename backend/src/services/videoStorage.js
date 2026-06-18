const fs = require('fs');
const path = require('path');
const { CLIP_ID_PATTERN } = require('../utils/exportAnnotation');
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

function buildVideoUrl(clipId) {
  return `${getVideoBaseUrl()}/api/videos/${clipId}.mp4`;
}

function isRemoteVideoStorage() {
  return isVpsStorageEnabled();
}

async function listStoredClipIds() {
  if (isVpsStorageEnabled()) {
    const clipIds = await listVpsClipIds();
    return clipIds.filter((clipId) => CLIP_ID_PATTERN.test(clipId));
  }

  const dataDir = getVideoDataDir();
  if (!fs.existsSync(dataDir)) {
    return [];
  }

  return fs
    .readdirSync(dataDir)
    .filter((name) => name.toLowerCase().endsWith('.mp4'))
    .map((name) => name.replace(/\.mp4$/i, ''))
    .filter((clipId) => CLIP_ID_PATTERN.test(clipId))
    .sort();
}

async function storeVideoFile(clipId, file) {
  if (isVpsStorageEnabled()) {
    const data = file.buffer || fs.readFileSync(file.path);
    await uploadVideoToVps(clipId, data);
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    return { storage: 'vps', clipId };
  }

  if (file.path) {
    return { storage: 'local', clipId, path: file.path };
  }

  const filePath = path.join(getVideoDataDir(), `${clipId}.mp4`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, file.buffer);
  return { storage: 'local', clipId, path: filePath };
}

async function removeStoredVideoFile(clipId) {
  if (isVpsStorageEnabled()) {
    await deleteVideoFromVps(clipId);
    return true;
  }

  const filePath = path.join(getVideoDataDir(), `${clipId}.mp4`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
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
  listStoredClipIds,
  storeVideoFile,
  removeStoredVideoFile,
  getStorageStatus,
};
