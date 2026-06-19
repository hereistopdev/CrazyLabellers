const mongoose = require('mongoose');

const earningsPaymentLineSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['task', 'badge'], required: true },
    submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabelSubmission' },
    badgeGrantId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabellerBadgeGrant' },
    title: { type: String, default: '' },
    amount: { type: Number, required: true },
    reviewPoints: { type: Number },
  },
  { _id: false }
);

const earningsPaymentSchema = new mongoose.Schema(
  {
    labellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, default: '' },
    currency: { type: String, default: 'USD' },
    taskEarnings: { type: Number, default: 0 },
    badgeEarnings: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    lineItems: [earningsPaymentLineSchema],
  },
  { timestamps: true }
);

earningsPaymentSchema.index({ labellerId: 1, createdAt: -1 });

module.exports = mongoose.model('EarningsPayment', earningsPaymentSchema);
