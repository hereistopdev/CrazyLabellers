const express = require('express');
const LabellerReview = require('../models/LabellerReview');
const { auth } = require('../middleware/auth');
const { isLabeller } = require('../config/roles');
const { getLabellerEarningsSummary } = require('../services/labellerEarnings');

const router = express.Router();

router.get('/me', auth, async (req, res) => {
  try {
    if (!isLabeller(req.user)) {
      return res.status(403).json({ message: 'Only labellers have earnings' });
    }

    const earnings = await getLabellerEarningsSummary(req.user._id);

    const reviews = await LabellerReview.find({
      submissionId: { $in: earnings.tasks.map((task) => task.id) },
    });
    const ratingBySubmission = new Map(reviews.map((review) => [String(review.submissionId), review]));

    return res.json({
      ...earnings,
      tasks: earnings.tasks.map((task) => {
        const review = ratingBySubmission.get(String(task.id));
        return {
          ...task,
          rating: review?.rating ?? null,
          reviewComment: review?.comment || '',
        };
      }),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
