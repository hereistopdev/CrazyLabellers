const express = require('express');
const Terminology = require('../models/Terminology');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const terms = await Terminology.find().sort({ order: 1 });
    return res.json(terms);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/:eventType', async (req, res) => {
  try {
    const term = await Terminology.findOne({
      eventType: decodeURIComponent(req.params.eventType),
    });
    if (!term) {
      return res.status(404).json({ message: 'Terminology not found' });
    }
    return res.json(term);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const term = await Terminology.create(req.body);
    return res.status(201).json(term);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.put('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const term = await Terminology.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!term) {
      return res.status(404).json({ message: 'Terminology not found' });
    }
    return res.json(term);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

module.exports = router;
