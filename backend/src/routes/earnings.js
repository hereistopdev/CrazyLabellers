const express = require('express');
const LabelSubmission = require('../models/LabelSubmission');
const LabellerReview = require('../models/LabellerReview');
const LabellerBadgeGrant = require('../models/LabellerBadgeGrant');
const PaymentSettings = require('../models/PaymentSettings');
const User = require('../models/User');
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
      .populate('assignmentId', 'title taskPrice challengeNote kind')
      .sort({ updatedAt: -1 });

    const paidSubmissions = submissions.filter(
      (s) => s.assignmentId && !['tutorial', 'pretest'].includes(s.assignmentId.kind)
    );

    const approved = paidSubmissions.filter((s) => s.status === 'approved');
    const taskEarnings = approved.reduce((sum, s) => sum + (s.earnings || 0), 0);
    const totalPoints = approved.reduce((sum, s) => sum + (s.reviewPoints || 0), 0);

    const [reviews, badgeGrants, user] = await Promise.all([
      LabellerReview.find({
        submissionId: { $in: submissions.map((s) => s._id) },
      }),
      LabellerBadgeGrant.find({ userId: req.user._id }).sort({ createdAt: -1 }),
      User.findById(req.user._id).select('totalBadgeEarnings').lean(),
    ]);

    const badgeEarnings = user?.totalBadgeEarnings ?? badgeGrants.reduce((sum, g) => sum + g.bonusAmount, 0);
    const totalEarnings = Math.round((taskEarnings + badgeEarnings) * 100) / 100;
    const ratingBySubmission = new Map(reviews.map((r) => [String(r.submissionId), r]));

    return res.json({
      settings: { ratePerPoint: settings.ratePerPoint, currency: settings.currency },
      summary: {
        totalEarnings,
        taskEarnings: Math.round(taskEarnings * 100) / 100,
        badgeEarnings: Math.round(badgeEarnings * 100) / 100,
        totalPoints,
        tasksCompleted: approved.length,
        avgPoints: approved.length
          ? Math.round((totalPoints / approved.length) * 10) / 10
          : 0,
        pendingReview: paidSubmissions.filter((s) => s.status === 'submitted').length,
        badgesEarned: badgeGrants.length,
      },
      badgeGrants: badgeGrants.map((grant) => ({
        id: grant._id,
        badgeId: grant.badgeId,
        title: grant.title,
        icon: grant.icon,
        clipThreshold: grant.clipThreshold,
        tier: grant.tier,
        bonusAmount: grant.bonusAmount,
        earnedAt: grant.createdAt,
      })),
      tasks: paidSubmissions.map((s) => {
        const review = ratingBySubmission.get(String(s._id));
        return {
          id: s._id,
          title: s.assignmentId?.title,
          taskPrice: s.assignmentId?.taskPrice,
          challengeNote: s.assignmentId?.challengeNote,
          status: s.status,
          reviewPoints: s.reviewPoints,
          earnings: s.earnings,
          rating: review?.rating ?? null,
          reviewComment: review?.comment || '',
          eventsCount: s.events?.length || 0,
          reviewedAt: s.reviewedAt,
          reviewerNotes: s.reviewerNotes,
          submittedAt: s.updatedAt,
        };
      }),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
