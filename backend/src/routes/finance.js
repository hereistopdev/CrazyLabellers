const express = require('express');
const User = require('../models/User');
const LabelSubmission = require('../models/LabelSubmission');
const PaymentSettings = require('../models/PaymentSettings');
const { auth, requireRole } = require('../middleware/auth');
const { LABELLER_ROLES } = require('../config/roles');
const { calculateEarnings, DEFAULT_RATE_PER_POINT } = require('../config/payments');

const router = express.Router();

async function getSettings() {
  let settings = await PaymentSettings.findOne();
  if (!settings) {
    settings = await PaymentSettings.create({ ratePerPoint: DEFAULT_RATE_PER_POINT });
  }
  return settings;
}

async function aggregateLabellerEarnings(matchExtra = {}) {
  return LabelSubmission.aggregate([
    { $match: { status: 'approved', reviewPoints: { $ne: null }, ...matchExtra } },
    {
      $group: {
        _id: '$userId',
        totalEarnings: { $sum: '$earnings' },
        totalPoints: { $sum: '$reviewPoints' },
        tasksCompleted: { $sum: 1 },
        avgPoints: { $avg: '$reviewPoints' },
      },
    },
  ]);
}

router.get('/settings', auth, requireRole('admin'), async (_req, res) => {
  try {
    const settings = await getSettings();
    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch('/settings', auth, requireRole('admin'), async (req, res) => {
  try {
    const { ratePerPoint, currency } = req.body;
    const settings = await getSettings();

    if (ratePerPoint !== undefined) settings.ratePerPoint = ratePerPoint;
    if (currency) settings.currency = currency;
    await settings.save();

    return res.json(settings);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/dashboard', auth, requireRole('admin'), async (_req, res) => {
  try {
    const settings = await getSettings();
    const [totals, pendingPayout, labellerStats, recentReviews] = await Promise.all([
      LabelSubmission.aggregate([
        { $match: { status: 'approved', earnings: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            totalPaid: { $sum: '$earnings' },
            totalPoints: { $sum: '$reviewPoints' },
            tasksReviewed: { $sum: 1 },
          },
        },
      ]),
      LabelSubmission.countDocuments({ status: 'submitted' }),
      aggregateLabellerEarnings(),
      LabelSubmission.find({ status: { $in: ['approved', 'rejected'] }, reviewedAt: { $ne: null } })
        .populate('userId', 'name email')
        .populate('assignmentId', 'title')
        .sort({ reviewedAt: -1 })
        .limit(10),
    ]);

    const summary = totals[0] || { totalPaid: 0, totalPoints: 0, tasksReviewed: 0 };

    const labellerIds = labellerStats.map((s) => s._id);
    const labellers = await User.find({ _id: { $in: labellerIds } }).select('name email status');

    const earningsByLabeller = labellerStats
      .map((stat) => {
        const labeller = labellers.find((l) => l._id.toString() === stat._id.toString());
        return {
          labellerId: stat._id,
          name: labeller?.name || 'Unknown',
          email: labeller?.email,
          status: labeller?.status,
          totalEarnings: Math.round(stat.totalEarnings * 100) / 100,
          totalPoints: stat.totalPoints,
          tasksCompleted: stat.tasksCompleted,
          avgPoints: Math.round(stat.avgPoints * 10) / 10,
        };
      })
      .sort((a, b) => b.totalEarnings - a.totalEarnings);

    return res.json({
      settings,
      totalPaid: summary.totalPaid,
      totalPointsAwarded: summary.totalPoints,
      tasksReviewed: summary.tasksReviewed,
      pendingReviews: pendingPayout,
      earningsByLabeller,
      recentReviews,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/labellers', auth, requireRole('admin'), async (_req, res) => {
  try {
    const labellers = await User.find({ role: { $in: LABELLER_ROLES } }).select('-password');
    const stats = await aggregateLabellerEarnings();

    const result = labellers.map((l) => {
      const stat = stats.find((s) => s._id.toString() === l._id.toString());
      return {
        id: l._id,
        name: l.name,
        email: l.email,
        status: l.status,
        totalEarnings: stat ? Math.round(stat.totalEarnings * 100) / 100 : 0,
        totalPoints: stat?.totalPoints || 0,
        tasksCompleted: stat?.tasksCompleted || 0,
        avgPoints: stat ? Math.round(stat.avgPoints * 10) / 10 : 0,
      };
    });

    return res.json(result.sort((a, b) => b.totalEarnings - a.totalEarnings));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/labellers/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const labeller = await User.findOne({
      _id: req.params.id,
      role: { $in: LABELLER_ROLES },
    }).select('-password');

    if (!labeller) {
      return res.status(404).json({ message: 'Labeller not found' });
    }

    const submissions = await LabelSubmission.find({
      userId: labeller._id,
      status: { $in: ['submitted', 'approved', 'rejected'] },
    })
      .populate('assignmentId', 'title')
      .sort({ updatedAt: -1 });

    const approved = submissions.filter((s) => s.status === 'approved');
    const totalEarnings = approved.reduce((sum, s) => sum + (s.earnings || 0), 0);
    const totalPoints = approved.reduce((sum, s) => sum + (s.reviewPoints || 0), 0);

    return res.json({
      labeller,
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
