const fs = require('fs');
const path = require('path');
const express = require('express');
const { isSafeVideoFilename, getVideoExtension } = require('../utils/clipId');
const { findLocalVideoPath } = require('../services/videoStorage');

const CONTENT_TYPES = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.m4v': 'video/x-m4v',
};

const router = express.Router();

router.get('/:clipFilename', (req, res) => {
  const clipFilename = decodeURIComponent(req.params.clipFilename);
  const filename = path.basename(clipFilename);

  if (!isSafeVideoFilename(filename)) {
    return res.status(400).json({ message: 'Invalid video file' });
  }

  const filePath = findLocalVideoPath(filename);
  if (!filePath) {
    return res.status(404).json({ message: 'Video not found' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const contentType = CONTENT_TYPES[getVideoExtension(filename)] || 'application/octet-stream';

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);
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
