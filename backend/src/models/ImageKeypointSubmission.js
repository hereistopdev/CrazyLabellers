const mongoose = require('mongoose');
const { LABEL_IDS } = require('../config/imageKeypoints');

const keypointSchema = new mongoose.Schema(
  {
    label: { type: String, enum: LABEL_IDS, required: true },
    x: { type: Number, required: true, min: 0, max: 1 },
    y: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false }
);

const imageKeypointSubmissionSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ImageAssignment',
      required: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    keypoints: { type: [keypointSchema], default: [] },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'rejected'],
      default: 'draft',
    },
    reviewPoints: { type: Number, min: 0, max: 100 },
    reviewerNotes: { type: String, default: '' },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

imageKeypointSubmissionSchema.index({ assignmentId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('ImageKeypointSubmission', imageKeypointSubmissionSchema);
