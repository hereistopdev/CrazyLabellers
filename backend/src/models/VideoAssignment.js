const mongoose = require('mongoose');
const { normalizeTutorialSteps } = require('../utils/normalizeTutorialSteps');

const videoAssignmentSchema = new mongoose.Schema(
  {
    clipId: { type: String, unique: true, sparse: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    videoUrl: { type: String, required: true },
    gameTime: { type: String, default: '1 - 00:00' },
    fps: { type: Number, default: 25 },
    durationSeconds: { type: Number, default: 30 },
    kind: {
      type: String,
      enum: ['tutorial', 'pretest', 'production'],
      default: 'production',
    },
    sortOrder: { type: Number, default: 0 },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'TaskGroup' },
    tutorialIntro: { type: String, default: '' },
    // Plain objects — eventType/explanation are optional; admin fills in gradually.
    tutorialSteps: { type: [mongoose.Schema.Types.Mixed], default: [] },
    taskPrice: { type: Number, default: 1, min: 0, max: 2 },
    challengeNote: { type: String, default: '' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['available', 'assigned', 'in_progress', 'submitted', 'approved', 'rejected'],
      default: 'available',
    },
    dueDate: { type: Date },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    referenceUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    referenceUpdatedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

videoAssignmentSchema.pre('save', function normalizeStepsOnSave() {
  if (Array.isArray(this.tutorialSteps)) {
    this.tutorialSteps = normalizeTutorialSteps(this.tutorialSteps);
  }
});

module.exports = mongoose.model('VideoAssignment', videoAssignmentSchema);
