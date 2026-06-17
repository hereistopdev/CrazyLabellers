const mongoose = require('mongoose');

const videoAssignmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    videoUrl: { type: String, required: true },
    durationSeconds: { type: Number, default: 30 },
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
