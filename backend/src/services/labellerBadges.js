const LabelSubmission = require('../models/LabelSubmission');
const LabellerBadgeGrant = require('../models/LabellerBadgeGrant');
const User = require('../models/User');
const {
  getVolumeBadgeCatalog,
  getBadgeById,
  badgeBonusAmount,
} = require('../config/labellerBadges');

async function getProductionApprovedCount(userId) {
  const submissions = await LabelSubmission.find({
    userId,
    status: 'approved',
  })
    .populate('assignmentId', 'kind')
    .select('assignmentId');

  return submissions.filter(
    (submission) =>
      submission.assignmentId &&
      !['tutorial', 'pretest'].includes(submission.assignmentId.kind)
  ).length;
}

async function getEarnedBadgeIds(userId) {
  const grants = await LabellerBadgeGrant.find({ userId }).select('badgeId').lean();
  return new Set(grants.map((grant) => grant.badgeId));
}

function buildBadgeProgress(jobsCompleted, earnedBadgeIds) {
  const earnedSet = earnedBadgeIds instanceof Set ? earnedBadgeIds : new Set(earnedBadgeIds);

  return getVolumeBadgeCatalog().map((badge) => {
    const earned = earnedSet.has(badge.id);
    const progress = Math.min(100, Math.round((jobsCompleted / badge.clipThreshold) * 100));
    return {
      ...badge,
      earned,
      earnedAt: null,
      progress: earned ? 100 : progress,
      remaining: earned ? 0 : Math.max(0, badge.clipThreshold - jobsCompleted),
    };
  });
}

async function getLabellerBadgeSummary(userId) {
  await checkAndGrantBadges(userId);

  const [jobsCompleted, grants, user] = await Promise.all([
    getProductionApprovedCount(userId),
    LabellerBadgeGrant.find({ userId }).sort({ clipThreshold: 1 }).lean(),
    User.findById(userId).select('totalBadgeEarnings').lean(),
  ]);

  const earnedMap = new Map(grants.map((grant) => [grant.badgeId, grant]));
  const badges = buildBadgeProgress(jobsCompleted, earnedMap.keys()).map((badge) => {
    const grant = earnedMap.get(badge.id);
    if (!grant) return badge;
    return {
      ...badge,
      earned: true,
      earnedAt: grant.createdAt,
      bonusPaid: grant.bonusAmount,
    };
  });

  const totalBadgeEarnings =
    user?.totalBadgeEarnings ??
    grants.reduce((sum, grant) => sum + (grant.bonusAmount || 0), 0);

  const nextBadge = badges.find((badge) => !badge.earned) || null;

  return {
    jobsCompleted,
    totalBadgeEarnings: Math.round(totalBadgeEarnings * 100) / 100,
    earnedCount: grants.length,
    totalBadges: badges.length,
    badges,
    nextBadge,
    recentGrants: grants
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map((grant) => ({
        badgeId: grant.badgeId,
        title: grant.title,
        icon: grant.icon,
        bonusAmount: grant.bonusAmount,
        earnedAt: grant.createdAt,
      })),
  };
}

async function checkAndGrantBadges(userId) {
  const jobsCompleted = await getProductionApprovedCount(userId);
  const earnedBadgeIds = await getEarnedBadgeIds(userId);
  const newlyGranted = [];

  for (const badge of getVolumeBadgeCatalog()) {
    if (jobsCompleted < badge.clipThreshold || earnedBadgeIds.has(badge.id)) {
      continue;
    }

    const bonusAmount = badgeBonusAmount(badge.clipThreshold);

    try {
      await LabellerBadgeGrant.create({
        userId,
        badgeId: badge.id,
        title: badge.title,
        icon: badge.icon,
        clipThreshold: badge.clipThreshold,
        tier: badge.tier,
        bonusAmount,
        jobsCompletedAtGrant: jobsCompleted,
      });

      await User.updateOne({ _id: userId }, { $inc: { totalBadgeEarnings: bonusAmount } });

      newlyGranted.push({
        ...badge,
        bonusAmount,
        jobsCompletedAtGrant: jobsCompleted,
      });
      earnedBadgeIds.add(badge.id);
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }
    }
  }

  return newlyGranted;
}

async function processApprovalBadges(userId, assignmentKind) {
  if (['tutorial', 'pretest'].includes(assignmentKind)) {
    return [];
  }
  return checkAndGrantBadges(userId);
}

module.exports = {
  getProductionApprovedCount,
  getLabellerBadgeSummary,
  checkAndGrantBadges,
  processApprovalBadges,
  buildBadgeProgress,
  getBadgeById,
};
