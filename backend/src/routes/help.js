const express = require('express');
const { auth, requireRole } = require('../middleware/auth');
const HelpConversation = require('../models/HelpConversation');
const FrequentQA = require('../models/FrequentQA');
const {
  sendHelpMessage,
  listFrequentQA,
  getFrequentQA,
} = require('../services/helpAssistant');

const router = express.Router();

router.post('/chat', auth, async (req, res) => {
  try {
    const { conversationId, message, selectedOption, assignmentId, context } = req.body;

    const result = await sendHelpMessage({
      user: req.user,
      conversationId,
      message,
      selectedOption,
      assignmentId,
      context,
    });

    return res.json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/conversations/:id', auth, async (req, res) => {
  try {
    const conversation = await HelpConversation.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).lean();

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    return res.json(conversation);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/faq', auth, async (req, res) => {
  try {
    const { search, eventType } = req.query;
    const includeUnpublished = req.user.role === 'admin' && req.query.all === 'true';

    const entries = await listFrequentQA({
      search,
      eventType,
      includeUnpublished,
    });

    return res.json(entries);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/faq/:id', auth, async (req, res) => {
  try {
    const entry = await getFrequentQA(req.params.id, { incrementView: true });
    if (!entry) {
      return res.status(404).json({ message: 'FAQ entry not found' });
    }
    if (!entry.published && req.user.role !== 'admin') {
      return res.status(404).json({ message: 'FAQ entry not found' });
    }
    return res.json(entry);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.patch('/faq/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { title, answer, published } = req.body;
    const update = {};

    if (title != null) update.title = String(title).trim();
    if (answer != null) update.answer = String(answer).trim();
    if (published != null) update.published = Boolean(published);

    const entry = await FrequentQA.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('createdBy', 'name email role')
      .lean();

    if (!entry) {
      return res.status(404).json({ message: 'FAQ entry not found' });
    }

    return res.json(entry);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.delete('/faq/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const entry = await FrequentQA.findByIdAndDelete(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: 'FAQ entry not found' });
    }
    return res.json({ message: 'FAQ entry deleted' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

module.exports = router;
