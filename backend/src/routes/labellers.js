const express = require('express');
const { auth } = require('../middleware/auth');
const { buildLabellerProfile } = require('../services/labellerProfile');

const router = express.Router();

router.get('/me/profile', auth, async (req, res) => {
  try {
    const profile = await buildLabellerProfile(req.user._id);
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    return res.json(profile);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/:id/profile', auth, async (req, res) => {
  try {
    const profile = await buildLabellerProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ message: 'Labeller not found' });
    }
    return res.json(profile);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
