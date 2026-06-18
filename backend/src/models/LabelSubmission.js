const mongoose = require('mongoose');
const { EVENT_TYPES } = require('../config/events');

const eventLabelSchema = new mongoose.Schema(
  {
    eventType: { type: String, enum: EVENT_TYPES, required: true },
    frameTime: { type: Number, required: true },
    playheadTime: { type: Number },
    frameOffset: { type: Number },
    immediateFollowUp: { type: Boolean, default: false },
    afterEvent: { type: String },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const eventValidationSchema = new mongoose.Schema(
  {
    eventIndex: { type: Number, required: true },
    status: {
      type: String,
      enum: ['valid', 'invalid', 'pending'],
      default: 'pending',
    },
    notes: { type: String, default: '' },
    validatedAt: { type: Date },
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const labelSubmissionSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VideoAssignment',
      required: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    events: [eventLabelSchema],
    eventValidations: [eventValidationSchema],
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'rejected'],
      default: 'draft',
    },
    reviewPoints: { type: Number, min: 0, max: 100 },
    earnings: { type: Number, default: 0 },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewerNotes: { type: String, default: '' },
    autoScore: { type: Number, min: 0, max: 100 },
    autoScoreBreakdown: { type: [mongoose.Schema.Types.Mixed], default: undefined },
    pretestScoreReviewSeenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

labelSubmissionSchema.index({ assignmentId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('LabelSubmission', labelSubmissionSchema);
