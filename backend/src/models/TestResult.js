const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestQuestion', required: true },
    selectedAnswer: { type: String, required: true },
    correctAnswer: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
  },
  { _id: false }
);

const testResultSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    answers: [answerSchema],
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    passThreshold: { type: Number, default: 80 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TestResult', testResultSchema);
