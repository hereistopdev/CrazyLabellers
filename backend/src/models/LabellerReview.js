const mongoose = require('mongoose');

const aspectRatingsSchema = new mongoose.Schema(
  {
    quality: { type: Number, min: 1, max: 5 },
    accuracy: { type: Number, min: 1, max: 5 },
    timeliness: { type: Number, min: 1, max: 5 },
  },
  { _id: false }
);

const labellerReviewSchema = new mongoose.Schema(
  {
    labellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabelSubmission',
      required: true,
      unique: true,
    },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
    aspects: aspectRatingsSchema,
    assignmentTitle: { type: String, default: '' },
    taskPrice: { type: Number },
    reviewPoints: { type: Number, min: 0, max: 100 },
    earnings: { type: Number, default: 0 },
  },
  { timestamps: true }
);

labellerReviewSchema.index({ labellerId: 1, createdAt: -1 });

module.exports = mongoose.model('LabellerReview', labellerReviewSchema);
