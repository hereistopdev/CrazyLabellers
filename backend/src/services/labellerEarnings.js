const LabelSubmission = require('../models/LabelSubmission');
const LabellerBadgeGrant = require('../models/LabellerBadgeGrant');
const EarningsPayment = require('../models/EarningsPayment');
const PaymentSettings = require('../models/PaymentSettings');
const { DEFAULT_RATE_PER_POINT } = require('../config/payments');

function roundMoney(value) {
  return Math.round((value || 0) * 100) / 100;
}

function isProductionSubmission(submission) {
  const kind = submission.assignmentId?.kind;
  return submission.assignmentId && !['tutorial', 'pretest'].includes(kind);
}

async function getPaymentSettings() {
  let settings = await PaymentSettings.findOne();
  if (!settings) {
    settings = { ratePerPoint: DEFAULT_RATE_PER_POINT, currency: 'USD' };
  }
  return settings;
}

async function loadProductionSubmissions(labellerId) {
  return LabelSubmission.find({
    userId: labellerId,
    status: { $in: ['submitted', 'approved', 'rejected'] },
  })
    .populate('assignmentId', 'title taskPrice challengeNote kind')
    .sort({ updatedAt: -1 });
}

function summarizeSubmissions(submissions) {
  const production = submissions.filter(isProductionSubmission);
  const approved = production.filter((s) => s.status === 'approved');
  const unpaidApproved = approved.filter((s) => !s.earningsPaidOutAt);

  const pendingTaskEarnings = unpaidApproved.reduce((sum, s) => sum + (s.earnings || 0), 0);
  const lifetimeTaskEarnings = approved.reduce((sum, s) => sum + (s.earnings || 0), 0);
  const paidTaskEarnings = approved
    .filter((s) => s.earningsPaidOutAt)
    .reduce((sum, s) => sum + (s.earnings || 0), 0);
  const totalPoints = approved.reduce((sum, s) => sum + (s.reviewPoints || 0), 0);

  return {
    production,
    approved,
    unpaidApproved,
    pendingTaskEarnings: roundMoney(pendingTaskEarnings),
    lifetimeTaskEarnings: roundMoney(lifetimeTaskEarnings),
    paidTaskEarnings: roundMoney(paidTaskEarnings),
    totalPoints,
    tasksCompleted: approved.length,
    pendingReview: production.filter((s) => s.status === 'submitted').length,
  };
}

async function getLabellerEarningsSummary(labellerId) {
  const [submissions, badgeGrants, payments, settings] = await Promise.all([
    loadProductionSubmissions(labellerId),
    LabellerBadgeGrant.find({ userId: labellerId }).sort({ createdAt: -1 }),
    EarningsPayment.find({ labellerId }).sort({ createdAt: -1 }).populate('paidBy', 'name email'),
    getPaymentSettings(),
  ]);

  const submissionSummary = summarizeSubmissions(submissions);
  const unpaidBadges = badgeGrants.filter((grant) => !grant.paidOutAt);
  const pendingBadgeEarnings = unpaidBadges.reduce((sum, grant) => sum + (grant.bonusAmount || 0), 0);
  const lifetimeBadgeEarnings = badgeGrants.reduce((sum, grant) => sum + (grant.bonusAmount || 0), 0);
  const paidBadgeEarnings = badgeGrants
    .filter((grant) => grant.paidOutAt)
    .reduce((sum, grant) => sum + (grant.bonusAmount || 0), 0);

  const pendingBalance = roundMoney(submissionSummary.pendingTaskEarnings + pendingBadgeEarnings);
  const lifetimeEarned = roundMoney(submissionSummary.lifetimeTaskEarnings + lifetimeBadgeEarnings);
  const lifetimePaidOut = roundMoney(payments.reduce((sum, payment) => sum + payment.totalAmount, 0));

  return {
    settings: { ratePerPoint: settings.ratePerPoint, currency: settings.currency },
    summary: {
      pendingBalance,
      pendingTaskEarnings: submissionSummary.pendingTaskEarnings,
      pendingBadgeEarnings: roundMoney(pendingBadgeEarnings),
      lifetimeEarned,
      lifetimeTaskEarnings: submissionSummary.lifetimeTaskEarnings,
      lifetimeBadgeEarnings: roundMoney(lifetimeBadgeEarnings),
      lifetimePaidOut,
      paidTaskEarnings: submissionSummary.paidTaskEarnings,
      paidBadgeEarnings: roundMoney(paidBadgeEarnings),
      totalPoints: submissionSummary.totalPoints,
      tasksCompleted: submissionSummary.tasksCompleted,
      avgPoints: submissionSummary.tasksCompleted
        ? Math.round((submissionSummary.totalPoints / submissionSummary.tasksCompleted) * 10) / 10
        : 0,
      pendingReview: submissionSummary.pendingReview,
      badgesEarned: badgeGrants.length,
      unpaidTaskCount: submissionSummary.unpaidApproved.filter((s) => (s.earnings || 0) > 0).length,
      unpaidBadgeCount: unpaidBadges.length,
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
      paidOutAt: grant.paidOutAt,
      earningsPaymentId: grant.earningsPaymentId,
    })),
    paymentHistory: payments.map((payment) => ({
      id: payment._id,
      totalAmount: payment.totalAmount,
      taskEarnings: payment.taskEarnings,
      badgeEarnings: payment.badgeEarnings,
      currency: payment.currency,
      note: payment.note,
      paidByName: payment.paidBy?.name || 'Admin',
      paidAt: payment.createdAt,
      lineItems: payment.lineItems,
    })),
    tasks: submissionSummary.production.map((submission) => ({
      id: submission._id,
      title: submission.assignmentId?.title,
      taskPrice: submission.assignmentId?.taskPrice,
      challengeNote: submission.assignmentId?.challengeNote,
      status: submission.status,
      reviewPoints: submission.reviewPoints,
      earnings: submission.earnings,
      earningsPaidOutAt: submission.earningsPaidOutAt,
      earningsPaymentId: submission.earningsPaymentId,
      eventsCount: submission.events?.length || 0,
      reviewedAt: submission.reviewedAt,
      reviewerNotes: submission.reviewerNotes,
      submittedAt: submission.updatedAt,
    })),
  };
}

async function clearLabellerEarnings(labellerId, { paidBy, note = '' } = {}) {
  const [submissions, badgeGrants, settings] = await Promise.all([
    loadProductionSubmissions(labellerId),
    LabellerBadgeGrant.find({ userId: labellerId, paidOutAt: null }),
    getPaymentSettings(),
  ]);

  const unpaidSubmissions = submissions.filter(
    (submission) =>
      submission.status === 'approved' &&
      !submission.earningsPaidOutAt &&
      (submission.earnings || 0) > 0
  );
  const unpaidBadges = badgeGrants.filter((grant) => (grant.bonusAmount || 0) > 0);

  const taskEarnings = roundMoney(unpaidSubmissions.reduce((sum, s) => sum + (s.earnings || 0), 0));
  const badgeEarnings = roundMoney(unpaidBadges.reduce((sum, g) => sum + (g.bonusAmount || 0), 0));
  const totalAmount = roundMoney(taskEarnings + badgeEarnings);

  if (totalAmount <= 0) {
    const error = new Error('No pending earnings to clear for this labeller');
    error.status = 400;
    throw error;
  }

  const lineItems = [
    ...unpaidSubmissions.map((submission) => ({
      type: 'task',
      submissionId: submission._id,
      title: submission.assignmentId?.title || 'Labeling task',
      amount: submission.earnings || 0,
      reviewPoints: submission.reviewPoints,
    })),
    ...unpaidBadges.map((grant) => ({
      type: 'badge',
      badgeGrantId: grant._id,
      title: grant.title,
      amount: grant.bonusAmount,
    })),
  ];

  const payment = await EarningsPayment.create({
    labellerId,
    paidBy,
    note: String(note || '').trim(),
    currency: settings.currency || 'USD',
    taskEarnings,
    badgeEarnings,
    totalAmount,
    lineItems,
  });

  const paidAt = payment.createdAt;

  if (unpaidSubmissions.length > 0) {
    await LabelSubmission.updateMany(
      { _id: { $in: unpaidSubmissions.map((s) => s._id) } },
      { earningsPaidOutAt: paidAt, earningsPaymentId: payment._id }
    );
  }

  if (unpaidBadges.length > 0) {
    await LabellerBadgeGrant.updateMany(
      { _id: { $in: unpaidBadges.map((g) => g._id) } },
      { paidOutAt: paidAt, earningsPaymentId: payment._id }
    );
  }

  return payment;
}

module.exports = {
  roundMoney,
  getLabellerEarningsSummary,
  clearLabellerEarnings,
};
