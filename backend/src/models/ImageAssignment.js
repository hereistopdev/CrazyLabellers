const mongoose = require('mongoose');

const imageAssignmentSchema = new mongoose.Schema(
  {
    imageId: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    imageUrl: { type: String, required: true },
    imageExtension: { type: String, default: '.png' },
    width: { type: Number },
    height: { type: Number },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'TaskGroup' },
    sortOrder: { type: Number, default: 0 },
    taskPrice: { type: Number, default: 0.5, min: 0, max: 2 },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['available', 'assigned', 'in_progress', 'submitted', 'approved', 'rejected'],
      default: 'available',
    },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    allowLabellerReference: { type: Boolean, default: false },
    hasReference: { type: Boolean, default: false },
    /** Full uploaded reference JSON (LabelMe / XAnyLabeling) for export merge */
    referenceJsonRaw: { type: String, default: '' },
    referenceUpdatedAt: { type: Date },
    referenceUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ImageAssignment', imageAssignmentSchema);
