const Terminology = require('../models/Terminology');
const TestQuestion = require('../models/TestQuestion');
const { terminologies } = require('./terminologyData');
const { testQuestions } = require('./data');

const DEPRECATED_EVENT_TYPES = ['Highlight Start', 'Highlight End'];

async function syncTerminology() {
  for (const term of terminologies) {
    await Terminology.findOneAndUpdate({ eventType: term.eventType }, term, {
      upsert: true,
      new: true,
      runValidators: true,
    });
  }

  await Terminology.deleteMany({ eventType: { $in: DEPRECATED_EVENT_TYPES } });
  return terminologies.length;
}

async function syncTestQuestions() {
  await TestQuestion.deleteMany({
    $or: [
      { correctAnswer: { $in: DEPRECATED_EVENT_TYPES } },
      { options: { $in: DEPRECATED_EVENT_TYPES } },
    ],
  });

  for (const question of testQuestions) {
    await TestQuestion.findOneAndUpdate({ scenario: question.scenario }, question, {
      upsert: true,
      new: true,
      runValidators: true,
    });
  }

  return testQuestions.length;
}

module.exports = { syncTerminology, syncTestQuestions, DEPRECATED_EVENT_TYPES };
