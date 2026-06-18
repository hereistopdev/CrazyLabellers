const mongoose = require('mongoose');

const tutorialStepSchema = new mongoose.Schema(
  {
    frameTime: { type: Number, required: true },
    eventType: { type: String, required: true },
    title: { type: String, default: '' },
    explanation: { type: String, required: true },
  },
  { _id: true }
);

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
    tutorialSteps: [tutorialStepSchema],
    taskPrice: { type: Number, default: 1, min: 0.3, max: 2 },
    challengeNote: { type: String, default: '' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['available', 'assigned', 'in_progress', 'submitted', 'approved', 'rejected'],
      default: 'available',
    },
    dueDate: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('VideoAssignment', videoAssignmentSchema);
