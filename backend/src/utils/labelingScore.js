const { compareAnnotations, DEFAULT_TOLERANCE_MS } = require('./compareAnnotations');
const { normalizeLabelEvents } = require('./normalizeLabelEvents');

const PASS_THRESHOLD = 80;
const FRAME_SCORE_STEP = 5;

function scoreForFrameDiff(frameDiff) {
  if (frameDiff <= 0) return 100;
  const score = 100 - frameDiff * FRAME_SCORE_STEP;
  return Math.max(0, score);
}

function getFrameDiff(timeDiffMs, fps = 25) {
  return Math.round((timeDiffMs * fps) / 1000);
}

function computeLabelingScore(submissionEvents = [], referenceEvents = [], fps = 25) {
  const comparison = compareAnnotations(submissionEvents, referenceEvents);
  const totalReference = comparison.summary.totalReference;

  if (totalReference === 0) {
    return {
      totalScore: 0,
      passed: false,
      passThreshold: PASS_THRESHOLD,
      pointsPerEvent: 0,
      breakdown: [],
      comparison,
      extraCount: comparison.summary.extraCount,
    };
  }

  const matchedByRef = new Map(comparison.matched.map((item) => [item.referenceIndex, item]));
  const sortedReference = normalizeLabelEvents(referenceEvents)
    .map((event, referenceIndex) => ({ ...event, referenceIndex }))
    .sort((a, b) => a.frameTime - b.frameTime);

  const breakdown = sortedReference.map((refEvent) => {
    const match = matchedByRef.get(refEvent.referenceIndex);
    if (!match) {
      return {
        referenceIndex: refEvent.referenceIndex,
        eventType: refEvent.eventType,
        referenceTime: refEvent.frameTime,
        score: 0,
        frameDiff: null,
        timeDiffMs: null,
        status: 'missing',
      };
    }

    const frameDiff = getFrameDiff(match.timeDiffMs, fps);
    return {
      referenceIndex: refEvent.referenceIndex,
      eventType: refEvent.eventType,
      referenceTime: refEvent.frameTime,
      submissionTime: match.submissionTime,
      submissionIndex: match.submissionIndex,
      score: scoreForFrameDiff(frameDiff),
      frameDiff,
      timeDiffMs: match.timeDiffMs,
      status: 'matched',
    };
  });

  const totalScore = Math.round(
    breakdown.reduce((sum, item) => sum + item.score, 0) / totalReference
  );

  return {
    totalScore,
    passed: totalScore >= PASS_THRESHOLD,
    passThreshold: PASS_THRESHOLD,
    pointsPerEvent: 100 / totalReference,
    breakdown,
    comparison,
    extraCount: comparison.summary.extraCount,
    matchedCount: comparison.summary.matchedCount,
    missingCount: comparison.summary.missingCount,
  };
}

module.exports = {
  PASS_THRESHOLD,
  FRAME_SCORE_STEP,
  DEFAULT_TOLERANCE_MS,
  scoreForFrameDiff,
  getFrameDiff,
  computeLabelingScore,
};
