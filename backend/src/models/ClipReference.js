const mongoose = require('mongoose');

const referenceEventSchema = new mongoose.Schema(
  {
    eventType: { type: String, required: true },
    frameTime: { type: Number, required: true },
  },
  { _id: false }
);

const clipReferenceSchema = new mongoose.Schema(
  {
    clipId: { type: String, required: true },
    variant: { type: String, enum: ['post', 'raw'], default: 'post' },
    events: [referenceEventSchema],
    annotationCount: { type: Number, default: 0 },
    sourceFilename: { type: String, default: '' },
  },
  { timestamps: true }
);

clipReferenceSchema.index({ clipId: 1, variant: 1 }, { unique: true });

module.exports = mongoose.model('ClipReference', clipReferenceSchema);
