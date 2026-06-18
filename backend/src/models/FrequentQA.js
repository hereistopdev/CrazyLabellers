const mongoose = require('mongoose');

const clarificationStepSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    options: [{ type: String }],
    selectedOption: { type: String },
  },
  { _id: false }
);

const frequentQASchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    relatedEventTypes: [{ type: String }],
    clarifications: [clarificationStepSchema],
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'HelpConversation' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, default: '' },
    published: { type: Boolean, default: true },
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

frequentQASchema.index({ published: 1, createdAt: -1 });
frequentQASchema.index({ relatedEventTypes: 1 });

module.exports = mongoose.model('FrequentQA', frequentQASchema);
