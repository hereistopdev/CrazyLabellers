const express = require('express');
const fs = require('fs');
const path = require('path');
const {
  findLocalImagePath,
  isRemoteImageStorage,
} = require('../services/imageStorage');
const { readImageFileFromVps } = require('../services/vpsStorage');
const { isSafeClipId } = require('../utils/clipId');

const router = express.Router();

function mimeForExtension(ext) {
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'image/jpeg';
  }
}

async function resolveImagePayload(raw) {
  const localPath = findLocalImagePath(raw);
  if (localPath) {
    return {
      kind: 'file',
      filePath: localPath,
      ext: path.extname(localPath).toLowerCase(),
    };
  }

  if (isRemoteImageStorage()) {
    const remote = await readImageFileFromVps(raw);
    if (remote) {
      return {
        kind: 'buffer',
        buffer: remote.buffer,
        ext: remote.ext,
      };
    }
  }

  return null;
}

function sendImagePayload(res, payload) {
  res.setHeader('Content-Type', mimeForExtension(payload.ext));
  res.setHeader('Cache-Control', 'public, max-age=86400');

  if (payload.kind === 'file') {
    return fs.createReadStream(payload.filePath).pipe(res);
  }

  return res.send(payload.buffer);
}

router.get('/:imageId', async (req, res) => {
  try {
    const raw = decodeURIComponent(req.params.imageId || '');
    const payload = await resolveImagePayload(raw);

    if (!payload) {
      return res.status(404).json({ message: 'Image not found' });
    }

    return sendImagePayload(res, payload);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.head('/:imageId', async (req, res) => {
  try {
    const raw = decodeURIComponent(req.params.imageId || '');
    const stem = raw.replace(/\.[^.]+$/, '');
    if (!isSafeClipId(stem)) {
      return res.status(404).end();
    }

    const payload = await resolveImagePayload(raw);
    if (!payload) return res.status(404).end();
    return res.status(200).end();
  } catch {
    return res.status(500).end();
  }
});

module.exports = router;
