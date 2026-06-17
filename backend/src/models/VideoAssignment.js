const mongoose = require('mongoose');

const videoAssignmentSchema = new mongoose.Schema(
  {
    clipId: { type: String, unique: true, sparse: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    videoUrl: { type: String, required: true },
    gameTime: { type: String, default: '1 - 00:00' },
    fps: { type: Number, default: 25 },
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
