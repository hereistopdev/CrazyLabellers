const fs = require('fs');
const path = require('path');
const SftpClient = require('ssh2-sftp-client');

function isVpsStorageEnabled() {
  const hasHost = Boolean(process.env.VPS_SSH_HOST?.trim());
  const hasAuth = Boolean(
    process.env.VPS_SSH_PRIVATE_KEY?.trim() || process.env.VPS_SSH_PASSWORD?.trim()
  );
  return hasHost && hasAuth;
}

function getVpsVideoDir() {
  return process.env.VPS_VIDEO_DIR?.trim() || '/var/www/football-clips';
}

function getVpsImageDir() {
  return process.env.VPS_IMAGE_DIR?.trim() || '/var/www/football-images';
}

function getSftpConfig() {
  const config = {
    host: process.env.VPS_SSH_HOST.trim(),
    port: parseInt(process.env.VPS_SSH_PORT || '22', 10),
    username: process.env.VPS_SSH_USER?.trim() || 'root',
    readyTimeout: 20000,
  };

  if (process.env.VPS_SSH_PRIVATE_KEY?.trim()) {
    config.privateKey = process.env.VPS_SSH_PRIVATE_KEY.replace(/\\n/g, '\n');
  }
  if (process.env.VPS_SSH_PASSWORD?.trim()) {
    config.password = process.env.VPS_SSH_PASSWORD;
  }

  return config;
}

async function withSftp(fn) {
  const sftp = new SftpClient();
  try {
    await sftp.connect(getSftpConfig());
    return await fn(sftp);
  } finally {
    sftp.end().catch(() => {});
  }
}

async function ensureVpsVideoDir(sftp) {
  const dir = getVpsVideoDir();
  const exists = await sftp.exists(dir);
  if (!exists) {
    await sftp.mkdir(dir, true);
  }
  return dir;
}

async function ensureVpsImageDir(sftp) {
  const dir = getVpsImageDir();
  const exists = await sftp.exists(dir);
  if (!exists) {
    await sftp.mkdir(dir, true);
  }
  return dir;
}

async function uploadFileToVpsDir(remoteDir, fileId, data, extension) {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  const remotePath = `${remoteDir}/${fileId}${ext}`;
  const localSize = Buffer.isBuffer(data) ? data.length : fs.statSync(data).size;

  await withSftp(async (sftp) => {
    const ensureDir = remoteDir === getVpsVideoDir() ? ensureVpsVideoDir : ensureVpsImageDir;
    await ensureDir(sftp);
    await sftp.put(data, remotePath);
    const stat = await sftp.stat(remotePath);
    if (stat.size !== localSize) {
      throw new Error(`Upload incomplete: expected ${localSize} bytes, got ${stat.size}`);
    }
  });
  return remotePath;
}

async function uploadVideoToVps(clipId, data, extension = '.mp4') {
  return uploadFileToVpsDir(getVpsVideoDir(), clipId, data, extension);
}

async function uploadImageToVps(imageId, data, extension = '.jpg') {
  return uploadFileToVpsDir(getVpsImageDir(), imageId, data, extension);
}

async function deleteFileFromVpsDir(remoteDir, fileId, extensions) {
  await withSftp(async (sftp) => {
    const exists = await sftp.exists(remoteDir);
    if (!exists) return;

    const files = await sftp.list(remoteDir);
    for (const file of files) {
      if (file.type !== '-') continue;
      const stem = file.name.replace(/(\.[a-z0-9]+)$/i, '');
      if (stem !== fileId) continue;
      if (extensions?.length) {
        const ext = path.extname(file.name).toLowerCase();
        if (!extensions.includes(ext)) continue;
      }
      await sftp.delete(`${remoteDir}/${file.name}`);
    }
  });
  return true;
}

const IMAGE_EXTENSIONS_FOR_DELETE = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'];

async function deleteVideoFromVps(clipId) {
  return deleteFileFromVpsDir(getVpsVideoDir(), clipId);
}

async function deleteImageFromVps(imageId) {
  return deleteFileFromVpsDir(getVpsImageDir(), imageId, IMAGE_EXTENSIONS_FOR_DELETE);
}

async function listVpsClipIds() {
  return withSftp(async (sftp) => {
    const dir = getVpsVideoDir();
    const exists = await sftp.exists(dir);
    if (!exists) {
      return [];
    }

    const files = await sftp.list(dir);
    const clipIds = new Set();
    for (const file of files) {
      if (file.type !== '-') continue;
      const lower = file.name.toLowerCase();
      if (!/(\.mp4|\.webm|\.mov|\.mkv|\.avi|\.m4v)$/.test(lower)) continue;
      clipIds.add(file.name.replace(/(\.[a-z0-9]+)$/i, ''));
    }
    return [...clipIds].sort();
  });
}

async function testVpsConnection() {
  if (!isVpsStorageEnabled()) {
    return { enabled: false, ok: false, message: 'VPS storage is not configured' };
  }

  try {
    const clipIds = await listVpsClipIds();
    return {
      enabled: true,
      ok: true,
      host: process.env.VPS_SSH_HOST,
      videoDir: getVpsVideoDir(),
      imageDir: getVpsImageDir(),
      clipCount: clipIds.length,
      videoBaseUrl: process.env.VIDEO_BASE_URL || null,
      imageBaseUrl: process.env.IMAGE_BASE_URL || process.env.VIDEO_BASE_URL || null,
    };
  } catch (error) {
    return {
      enabled: true,
      ok: false,
      host: process.env.VPS_SSH_HOST,
      message: error.message,
    };
  }
}

module.exports = {
  isVpsStorageEnabled,
  getVpsVideoDir,
  getVpsImageDir,
  withSftp,
  uploadVideoToVps,
  uploadImageToVps,
  deleteVideoFromVps,
  deleteImageFromVps,
  listVpsClipIds,
  testVpsConnection,
};
