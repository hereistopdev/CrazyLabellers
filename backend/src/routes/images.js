const express = require('express');
const fs = require('fs');
const path = require('path');
const { findLocalImagePath } = require('../services/imageStorage');
const { isSafeClipId } = require('../utils/clipId');

const router = express.Router();

router.get('/:imageId', (req, res) => {
  try {
    const raw = decodeURIComponent(req.params.imageId || '');
    const filePath = findLocalImagePath(raw);

    if (!filePath) {
      return res.status(404).json({ message: 'Image not found' });
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime =
      ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
            ? 'image/gif'
            : 'image/jpeg';

    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.head('/:imageId', (req, res) => {
  const raw = decodeURIComponent(req.params.imageId || '');
  const stem = raw.replace(/\.[^.]+$/, '');
  if (!isSafeClipId(stem) && !findLocalImagePath(raw)) {
    return res.status(404).end();
  }
  const filePath = findLocalImagePath(raw);
  if (!filePath) return res.status(404).end();
  return res.status(200).end();
});

module.exports = router;
