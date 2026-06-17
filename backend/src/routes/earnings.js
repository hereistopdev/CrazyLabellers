const express = require('express');
const LabelSubmission = require('../models/LabelSubmission');
const PaymentSettings = require('../models/PaymentSettings');
const { auth } = require('../middleware/auth');
const { isLabeller } = require('../config/roles');
const { DEFAULT_RATE_PER_POINT } = require('../config/payments');

const router = express.Router();

router.get('/me', auth, async (req, res) => {
  try {
    if (!isLabeller(req.user)) {
      return res.status(403).json({ message: 'Only labellers have earnings' });
    }

    let settings = await PaymentSettings.findOne();
    if (!settings) {
      settings = { ratePerPoint: DEFAULT_RATE_PER_POINT, currency: 'USD' };
    }

    const submissions = await LabelSubmission.find({
      userId: req.user._id,
      status: { $in: ['submitted', 'approved', 'rejected'] },
    })
      .populate('assignmentId', 'title')
      .sort({ updatedAt: -1 });

    const approved = submissions.filter((s) => s.status === 'approved');
    const totalEarnings = approved.reduce((sum, s) => sum + (s.earnings || 0), 0);
    const totalPoints = approved.reduce((sum, s) => sum + (s.reviewPoints || 0), 0);

    return res.json({
      settings: { ratePerPoint: settings.ratePerPoint, currency: settings.currency },
      summary: {
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        totalPoints,
        tasksCompleted: approved.length,
        avgPoints: approved.length
          ? Math.round((totalPoints / approved.length) * 10) / 10
          : 0,
        pendingReview: submissions.filter((s) => s.status === 'submitted').length,
      },
      tasks: submissions.map((s) => ({
        id: s._id,
        title: s.assignmentId?.title,
        status: s.status,
        reviewPoints: s.reviewPoints,
        earnings: s.earnings,
        eventsCount: s.events?.length || 0,
        reviewedAt: s.reviewedAt,
        reviewerNotes: s.reviewerNotes,
        submittedAt: s.updatedAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
