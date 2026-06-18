const mongoose = require('mongoose');

const helpMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    messageType: { type: String, enum: ['text', 'clarify', 'answer'], default: 'text' },
    options: [{ type: String }],
    selectedOption: { type: String },
  },
  { timestamps: true }
);

const helpConversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'VideoAssignment' },
    context: {
      page: { type: String, default: 'labeling' },
      assignmentKind: String,
      assignmentTitle: String,
      lastEventType: String,
      fps: Number,
    },
    messages: [helpMessageSchema],
    status: { type: String, enum: ['active', 'resolved'], default: 'active' },
    relatedEventTypes: [{ type: String }],
    frequentQAId: { type: mongoose.Schema.Types.ObjectId, ref: 'FrequentQA' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('HelpConversation', helpConversationSchema);
