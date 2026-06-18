const mongoose = require('mongoose');

const labellerBadgeGrantSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    badgeId: { type: String, required: true },
    title: { type: String, required: true },
    icon: { type: String, required: true },
    clipThreshold: { type: Number, required: true },
    tier: { type: String, required: true },
    bonusAmount: { type: Number, required: true },
    jobsCompletedAtGrant: { type: Number, required: true },
  },
  { timestamps: true }
);

labellerBadgeGrantSchema.index({ userId: 1, badgeId: 1 }, { unique: true });
labellerBadgeGrantSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('LabellerBadgeGrant', labellerBadgeGrantSchema);
