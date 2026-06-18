const fs = require('fs');
const path = require('path');
const express = require('express');
const { CLIP_ID_PATTERN } = require('../utils/exportAnnotation');
const { getVideoDataDir } = require('../services/videoStorage');

const router = express.Router();

router.get('/:clipId', (req, res) => {
  const clipId = req.params.clipId.replace(/\.mp4$/i, '');

  if (!CLIP_ID_PATTERN.test(clipId)) {
    return res.status(400).json({ message: 'Invalid clip ID' });
  }

  const filePath = path.join(getVideoDataDir(), `${clipId}.mp4`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Video not found' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Cache-Control', 'public, max-age=86400');

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      return res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
    }

    let start = match[1] ? parseInt(match[1], 10) : 0;
    let end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

    if (Number.isNaN(start) || Number.isNaN(end) || start >= fileSize) {
      return res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
    }

    end = Math.min(end, fileSize - 1);
    const chunkSize = end - start + 1;

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize);
    return fs.createReadStream(filePath, { start, end }).pipe(res);
  }

  res.setHeader('Content-Length', fileSize);
  return fs.createReadStream(filePath).pipe(res);
});

module.exports = router;
