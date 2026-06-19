const { compareAnnotations } = require('../utils/compareAnnotations');
const { computeLabelingScore } = require('../utils/labelingScore');
const { normalizeLabelEvents } = require('../utils/normalizeLabelEvents');

function buildCorrectionBreakdown(originalEvents = [], correctedEvents = [], fps = 25) {
  const original = normalizeLabelEvents(originalEvents);
  const corrected = normalizeLabelEvents(correctedEvents);
  const comparison = compareAnnotations(original, corrected);
  const scoreResult = computeLabelingScore(original, corrected, fps);

  const frameAdjustments = scoreResult.breakdown.filter(
    (item) => item.status === 'matched' && (item.frameDiff ?? 0) > 0
  ).length;
  const missedAdded = scoreResult.breakdown.filter((item) => item.status === 'missing').length;
  const wrongRemoved = comparison.summary.extraCount;

  return {
    frameAdjustments,
    missedAdded,
    wrongRemoved,
    totalCorrections: frameAdjustments + missedAdded + wrongRemoved,
    totalScore: scoreResult.totalScore,
    breakdown: scoreResult.breakdown,
    comparison,
  };
}

function applyCorrectionScore(submission, correctedEvents, assignment) {
  const originalEvents = submission.originalEvents?.length
    ? submission.originalEvents
    : submission.events;

  const correction = buildCorrectionBreakdown(
    originalEvents,
    correctedEvents,
    assignment?.fps || 25
  );

  submission.autoScore = correction.totalScore;
  submission.autoScoreBreakdown = correction.breakdown;
  submission.correctionBreakdown = {
    frameAdjustments: correction.frameAdjustments,
    missedAdded: correction.missedAdded,
    wrongRemoved: correction.wrongRemoved,
    totalCorrections: correction.totalCorrections,
  };

  return correction;
}

module.exports = {
  buildCorrectionBreakdown,
  applyCorrectionScore,
};
