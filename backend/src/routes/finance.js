const express = require('express');
const User = require('../models/User');
const LabelSubmission = require('../models/LabelSubmission');
const LabellerBadgeGrant = require('../models/LabellerBadgeGrant');
const PaymentSettings = require('../models/PaymentSettings');
const { auth, requireRole } = require('../middleware/auth');
const { LABELLER_ROLES } = require('../config/roles');
const { calculateEarnings, DEFAULT_RATE_PER_POINT } = require('../config/payments');
const { summarizePaymentAddresses } = require('../utils/paymentAddresses');
const { getLabellerEarningsSummary, clearLabellerEarnings } = require('../services/labellerEarnings');
const EarningsPayment = require('../models/EarningsPayment');

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
    {
      $match: {
        status: 'approved',
        reviewPoints: { $ne: null },
        earningsPaidOutAt: null,
        ...matchExtra,
      },
    },
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

router.get('/settings', auth, requireRole('admin', 'checker', 'validator'), async (_req, res) => {
  try {
    const settings = await getSettings();
    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch('/settings', auth, requireRole('admin'), async (req, res) => {
  try {
    const { ratePerPoint, currency, labellerImageLabelingEnabled } = req.body;
    const settings = await getSettings();

    if (ratePerPoint !== undefined) settings.ratePerPoint = ratePerPoint;
    if (currency) settings.currency = currency;
    if (labellerImageLabelingEnabled !== undefined) {
      settings.labellerImageLabelingEnabled = Boolean(labellerImageLabelingEnabled);
    }
    await settings.save();

    return res.json(settings);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/dashboard', auth, requireRole('admin'), async (_req, res) => {
  try {
    const settings = await getSettings();
    const [totals, pendingPayout, labellerStats, recentReviews, totalPaidOutAgg] = await Promise.all([
      LabelSubmission.aggregate([
        { $match: { status: 'approved', earnings: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            lifetimeTaskEarnings: { $sum: '$earnings' },
            totalPoints: { $sum: '$reviewPoints' },
            tasksReviewed: { $sum: 1 },
          },
        },
      ]),
      LabelSubmission.countDocuments({ status: 'submitted' }),
      aggregateLabellerEarnings({ earnings: { $gt: 0 } }),
      LabelSubmission.find({ status: { $in: ['approved', 'rejected'] }, reviewedAt: { $ne: null } })
        .populate('userId', 'name email')
        .populate('assignmentId', 'title')
        .sort({ reviewedAt: -1 })
        .limit(10),
      EarningsPayment.aggregate([
        { $group: { _id: null, totalPaidOut: { $sum: '$totalAmount' } } },
      ]),
    ]);

    const summary = totals[0] || { lifetimeTaskEarnings: 0, totalPoints: 0, tasksReviewed: 0 };
    const totalPaidOut = totalPaidOutAgg[0]?.totalPaidOut || 0;

    const labellerIds = labellerStats.map((s) => s._id);
    const [labellers, badgeGrants] = await Promise.all([
      User.find({ _id: { $in: labellerIds } }).select(
        'name email status paymentAddresses paymentAddressesUpdatedAt totalBadgeEarnings'
      ),
      LabellerBadgeGrant.find({ userId: { $in: labellerIds }, paidOutAt: null }),
    ]);

    const unpaidBadgeByLabeller = badgeGrants.reduce((map, grant) => {
      const key = String(grant.userId);
      map.set(key, (map.get(key) || 0) + (grant.bonusAmount || 0));
      return map;
    }, new Map());

    const earningsByLabeller = labellerStats
      .map((stat) => {
        const labeller = labellers.find((l) => l._id.toString() === stat._id.toString());
        const badgeEarnings = unpaidBadgeByLabeller.get(String(stat._id)) || 0;
        const taskEarnings = stat.totalEarnings || 0;
        return {
          labellerId: stat._id,
          name: labeller?.name || 'Unknown',
          email: labeller?.email,
          status: labeller?.status,
          paymentAddresses: summarizePaymentAddresses(labeller?.paymentAddresses),
          paymentAddressesUpdatedAt: labeller?.paymentAddressesUpdatedAt || null,
          pendingBalance: Math.round((taskEarnings + badgeEarnings) * 100) / 100,
          taskEarnings: Math.round(taskEarnings * 100) / 100,
          badgeEarnings: Math.round(badgeEarnings * 100) / 100,
          totalPoints: stat.totalPoints,
          tasksCompleted: stat.tasksCompleted,
          avgPoints: Math.round(stat.avgPoints * 10) / 10,
        };
      })
      .sort((a, b) => b.pendingBalance - a.pendingBalance);

    return res.json({
      settings,
      lifetimeTaskEarnings: summary.lifetimeTaskEarnings,
      totalPaidOut: Math.round(totalPaidOut * 100) / 100,
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
    const labellers = await User.find({ role: { $in: LABELLER_ROLES } }).select(
      '-password paymentAddresses paymentAddressesUpdatedAt'
    );
    const stats = await aggregateLabellerEarnings();

    const result = labellers.map((l) => {
      const stat = stats.find((s) => s._id.toString() === l._id.toString());
      return {
        id: l._id,
        name: l.name,
        email: l.email,
        status: l.status,
        paymentAddresses: summarizePaymentAddresses(l.paymentAddresses),
        paymentAddressesUpdatedAt: l.paymentAddressesUpdatedAt || null,
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

    const earnings = await getLabellerEarningsSummary(labeller._id);

    return res.json({
      labeller: {
        ...labeller.toObject(),
        paymentAddresses: summarizePaymentAddresses(labeller.paymentAddresses),
      },
      summary: earnings.summary,
      settings: earnings.settings,
      paymentHistory: earnings.paymentHistory,
      badgeGrants: earnings.badgeGrants,
      tasks: earnings.tasks,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/labellers/:id/clear-earnings', auth, requireRole('admin'), async (req, res) => {
  try {
    const labeller = await User.findOne({
      _id: req.params.id,
      role: { $in: LABELLER_ROLES },
    }).select('_id name');

    if (!labeller) {
      return res.status(404).json({ message: 'Labeller not found' });
    }

    const payment = await clearLabellerEarnings(labeller._id, {
      paidBy: req.user._id,
      note: req.body?.note,
    });

    const earnings = await getLabellerEarningsSummary(labeller._id);

    return res.json({
      message: `Cleared ${payment.totalAmount} ${payment.currency} pending earnings for ${labeller.name}`,
      payment: {
        id: payment._id,
        totalAmount: payment.totalAmount,
        taskEarnings: payment.taskEarnings,
        badgeEarnings: payment.badgeEarnings,
        currency: payment.currency,
        note: payment.note,
        paidAt: payment.createdAt,
        lineItems: payment.lineItems,
      },
      summary: earnings.summary,
      paymentHistory: earnings.paymentHistory,
      tasks: earnings.tasks,
      badgeGrants: earnings.badgeGrants,
    });
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }
});

module.exports = router;
