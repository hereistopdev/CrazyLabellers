const mongoose = require('mongoose');
const { EVENT_TYPES } = require('../config/events');

const testQuestionSchema = new mongoose.Schema(
  {
    scenario: { type: String, required: true },
    options: {
      type: [{ type: String, enum: EVENT_TYPES }],
      validate: [(v) => v.length >= 2, 'At least 2 options required'],
    },
    correctAnswer: { type: String, enum: EVENT_TYPES, required: true },
    explanation: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TestQuestion', testQuestionSchema);
