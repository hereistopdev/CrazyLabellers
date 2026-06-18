const express = require('express');
const fs = require('fs');
const path = require('path');
const { CLIP_ID_PATTERN } = require('../utils/exportAnnotation');

const router = express.Router();

const { getVideoDataDir } = require('../services/videoStorage');

router.get('/:clipId', (req, res) => {
  const clipId = req.params.clipId.replace(/\.mp4$/i, '');

  if (!CLIP_ID_PATTERN.test(clipId)) {
    return res.status(400).json({ message: 'Invalid clip ID' });
  }

  const filePath = path.join(getVideoDataDir(), `${clipId}.mp4`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Video not found' });
  }

  res.setHeader('Content-Type', 'video/mp4');
  res.sendFile(path.resolve(filePath));
});

module.exports = router;
