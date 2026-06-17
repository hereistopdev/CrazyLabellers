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

const labelSubmissionSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VideoAssignment',
      required: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    events: [eventLabelSchema],
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'rejected'],
      default: 'draft',
    },
    reviewerNotes: { type: String, default: '' },
  },
  { timestamps: true }
);

labelSubmissionSchema.index({ assignmentId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('LabelSubmission', labelSubmissionSchema);
