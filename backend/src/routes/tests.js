const express = require('express');
const TestQuestion = require('../models/TestQuestion');
const TestResult = require('../models/TestResult');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const PASS_THRESHOLD = 80;

router.get('/questions', auth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20);
    const questions = await TestQuestion.aggregate([
      { $match: { active: true } },
      { $sample: { size: limit } },
    ]);

    const sanitized = questions.map((q) => ({
      _id: q._id,
      scenario: q.scenario,
      options: q.options,
      difficulty: q.difficulty,
    }));

    return res.json({ questions: sanitized, passThreshold: PASS_THRESHOLD });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/submit', auth, async (req, res) => {
  try {
    const { answers } = req.body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: 'Answers array is required' });
    }

    const questionIds = answers.map((a) => a.questionId);
    const questions = await TestQuestion.find({ _id: { $in: questionIds } });
    const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));

    const gradedAnswers = answers.map((answer) => {
      const question = questionMap.get(answer.questionId);
      if (!question) {
        throw new Error(`Question ${answer.questionId} not found`);
      }
      const isCorrect = answer.selectedAnswer === question.correctAnswer;
      return {
        questionId: question._id,
        selectedAnswer: answer.selectedAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
      };
    });

    const correctCount = gradedAnswers.filter((a) => a.isCorrect).length;
    const score = Math.round((correctCount / gradedAnswers.length) * 100);
    const passed = score >= PASS_THRESHOLD;

    const result = await TestResult.create({
      userId: req.user._id,
      answers: gradedAnswers,
      score,
      totalQuestions: gradedAnswers.length,
      passed,
      passThreshold: PASS_THRESHOLD,
    });

    const user = await User.findById(req.user._id);
    user.testAttempts += 1;
    if (score > user.bestTestScore) {
      user.bestTestScore = score;
    }
    if (passed && user.status === 'pending') {
      user.status = 'passed_test';
    }
    await user.save();

    const explanations = gradedAnswers.map((a) => {
      const question = questionMap.get(a.questionId.toString());
      return {
        questionId: a.questionId,
        scenario: question.scenario,
        selectedAnswer: a.selectedAnswer,
        correctAnswer: a.correctAnswer,
        isCorrect: a.isCorrect,
        explanation: question.explanation,
      };
    });

    return res.json({
      resultId: result._id,
      score,
      totalQuestions: gradedAnswers.length,
      passed,
      passThreshold: PASS_THRESHOLD,
      explanations,
      userStatus: user.status,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/results', auth, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    const results = await TestResult.find(filter)
      .populate('userId', 'name email status bestTestScore')
      .sort({ createdAt: -1 })
      .limit(50);
    return res.json(results);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/results/:id', auth, async (req, res) => {
  try {
    const result = await TestResult.findById(req.params.id).populate(
      'userId',
      'name email'
    );
    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }
    if (
      req.user.role !== 'admin' &&
      result.userId._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Access denied' });
    }
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/questions', auth, requireRole('admin'), async (req, res) => {
  try {
    const question = await TestQuestion.create(req.body);
    return res.status(201).json(question);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

module.exports = router;
