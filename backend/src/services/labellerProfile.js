const User = require('../models/User');
const LabelSubmission = require('../models/LabelSubmission');
const LabellerReview = require('../models/LabellerReview');
const { summarizePaymentAddresses } = require('../utils/paymentAddresses');

async function getLabellerStats(labellerId) {
  const [reviews, approvedCount] = await Promise.all([
    LabellerReview.find({ labellerId }),
    LabelSubmission.countDocuments({ userId: labellerId, status: 'approved' }),
  ]);

  const reviewCount = reviews.length;
  const avgRating =
    reviewCount > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount) * 10) / 10
      : 0;

  const aspectTotals = { quality: 0, accuracy: 0, timeliness: 0 };
  let aspectCount = 0;
  reviews.forEach((review) => {
    if (!review.aspects) return;
    aspectTotals.quality += review.aspects.quality || 0;
    aspectTotals.accuracy += review.aspects.accuracy || 0;
    aspectTotals.timeliness += review.aspects.timeliness || 0;
    aspectCount += 1;
  });

  return {
    avgRating,
    reviewCount,
    jobsCompleted: approvedCount,
    aspectAverages:
      aspectCount > 0
        ? {
            quality: Math.round((aspectTotals.quality / aspectCount) * 10) / 10,
            accuracy: Math.round((aspectTotals.accuracy / aspectCount) * 10) / 10,
            timeliness: Math.round((aspectTotals.timeliness / aspectCount) * 10) / 10,
          }
        : null,
  };
}

async function upsertLabellerReview({
  labellerId,
  submissionId,
  reviewerId,
  rating,
  comment,
  aspects,
  assignmentTitle,
  taskPrice,
  reviewPoints,
  earnings,
}) {
  return LabellerReview.findOneAndUpdate(
    { submissionId },
    {
      labellerId,
      reviewerId,
      rating,
      comment: comment || '',
      aspects: aspects || undefined,
      assignmentTitle: assignmentTitle || '',
      taskPrice,
      reviewPoints,
      earnings,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function buildLabellerProfile(labellerId, { viewer } = {}) {
  const labeller = await User.findById(labellerId).select(
    'name email role status createdAt bestTestScore bestLabelingTestScore labelingTestPassed paymentAddresses paymentAddressesUpdatedAt'
  );
  if (!labeller || !['labeller', 'freelancer'].includes(labeller.role)) {
    return null;
  }

  const canSeePaymentAddresses =
    viewer &&
    (String(viewer._id) === String(labellerId) || viewer.role === 'admin');

  const stats = await getLabellerStats(labellerId);

  const [reviews, submissions] = await Promise.all([
    LabellerReview.find({ labellerId })
      .populate('reviewerId', 'name role')
      .sort({ createdAt: -1 })
      .limit(50),
    LabelSubmission.find({
      userId: labellerId,
      status: { $in: ['submitted', 'approved', 'rejected'] },
    })
      .populate('assignmentId', 'title taskPrice challengeNote')
      .sort({ updatedAt: -1 })
      .limit(50),
  ]);

  const reviewBySubmission = new Map(reviews.map((r) => [String(r.submissionId), r]));

  return {
    labeller: {
      _id: labeller._id,
      name: labeller.name,
      email: labeller.email,
      role: labeller.role,
      status: labeller.status,
      memberSince: labeller.createdAt,
      bestTestScore: labeller.bestTestScore,
      bestLabelingTestScore: labeller.bestLabelingTestScore,
      labelingTestPassed: labeller.labelingTestPassed,
      ...(canSeePaymentAddresses
        ? {
            paymentAddresses: summarizePaymentAddresses(labeller.paymentAddresses),
            paymentAddressesUpdatedAt: labeller.paymentAddressesUpdatedAt,
          }
        : {}),
      ...stats,
    },
    reviews: reviews.map((r) => ({
      _id: r._id,
      rating: r.rating,
      comment: r.comment,
      aspects: r.aspects,
      assignmentTitle: r.assignmentTitle,
      taskPrice: r.taskPrice,
      reviewPoints: r.reviewPoints,
      earnings: r.earnings,
      reviewerName: r.reviewerId?.name || 'Reviewer',
      reviewerRole: r.reviewerId?.role,
      createdAt: r.createdAt,
    })),
    workHistory: submissions.map((s) => {
      const review = reviewBySubmission.get(String(s._id));
      return {
        id: s._id,
        title: s.assignmentId?.title || 'Labeling task',
        taskPrice: s.assignmentId?.taskPrice,
        challengeNote: s.assignmentId?.challengeNote,
        status: s.status,
        reviewPoints: s.reviewPoints,
        earnings: s.earnings,
        eventsCount: s.events?.length || 0,
        rating: review?.rating ?? null,
        reviewComment: review?.comment || '',
        reviewedAt: s.reviewedAt,
        submittedAt: s.updatedAt,
      };
    }),
  };
}

module.exports = {
  getLabellerStats,
  upsertLabellerReview,
  buildLabellerProfile,
};
