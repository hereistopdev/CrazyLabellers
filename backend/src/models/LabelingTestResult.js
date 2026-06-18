const mongoose = require('mongoose');

const breakdownItemSchema = new mongoose.Schema(
  {
    referenceIndex: Number,
    eventType: String,
    referenceTime: Number,
    submissionTime: Number,
    submissionIndex: Number,
    score: Number,
    frameDiff: Number,
    timeDiffMs: Number,
    status: { type: String, enum: ['matched', 'missing'] },
  },
  { _id: false }
);

const labelingTestResultSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'VideoAssignment', required: true },
    submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabelSubmission' },
    score: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    passThreshold: { type: Number, default: 80 },
    breakdown: [breakdownItemSchema],
    matchedCount: { type: Number, default: 0 },
    missingCount: { type: Number, default: 0 },
    extraCount: { type: Number, default: 0 },
    referenceEventCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

labelingTestResultSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('LabelingTestResult', labelingTestResultSchema);
