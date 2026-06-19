const DEFAULT_TOLERANCE_MS = 250;
const { normalizeLabelEvents } = require('./normalizeLabelEvents');
const { getFrameDiffFromTimes } = require('./frameTime');

function getFrameDiff(timeDiffMs, fps = 25) {
  return Math.round((timeDiffMs * fps) / 1000);
}

function matchQualityFromFrameDiff(frameDiff) {
  if (frameDiff <= 0) return 'exact';
  if (frameDiff === 1) return 'close';
  return 'off';
}

function comparisonStatusFromMatch(match) {
  if (!match) return null;
  if (match.matchQuality === 'exact') return 'match';
  if (match.matchQuality === 'close') return 'close';
  if (match.matchQuality === 'off') return 'off';
  return 'close';
}

function compareAnnotations(
  submissionEvents = [],
  referenceEvents = [],
  toleranceMs = DEFAULT_TOLERANCE_MS,
  fps = 25
) {
  const sortedSubmission = normalizeLabelEvents(submissionEvents)
    .map((event, submissionIndex) => ({ ...event, submissionIndex }))
    .sort((a, b) => a.frameTime - b.frameTime);

  const sortedReference = normalizeLabelEvents(referenceEvents)
    .map((event, referenceIndex) => ({ ...event, referenceIndex }))
    .sort((a, b) => a.frameTime - b.frameTime);

  const usedReference = new Set();
  const matched = [];
  const extraInSubmission = [];

  sortedSubmission.forEach((submissionEvent) => {
    let bestMatch = null;

    sortedReference.forEach((referenceEvent) => {
      if (usedReference.has(referenceEvent.referenceIndex)) return;
      if (referenceEvent.eventType !== submissionEvent.eventType) return;

      const timeDiffMs = Math.abs(
        referenceEvent.frameTime * 1000 - submissionEvent.frameTime * 1000
      );
      const frameDiff = getFrameDiffFromTimes(
        referenceEvent.frameTime,
        submissionEvent.frameTime,
        fps
      );

      if (timeDiffMs <= toleranceMs && (!bestMatch || frameDiff < bestMatch.frameDiff)) {
        bestMatch = {
          referenceEvent,
          timeDiffMs,
          frameDiff,
        };
      }
    });

    if (bestMatch) {
      usedReference.add(bestMatch.referenceEvent.referenceIndex);
      const frameDiff = bestMatch.frameDiff;
      matched.push({
        submissionIndex: submissionEvent.submissionIndex,
        referenceIndex: bestMatch.referenceEvent.referenceIndex,
        eventType: submissionEvent.eventType,
        submissionTime: submissionEvent.frameTime,
        referenceTime: bestMatch.referenceEvent.frameTime,
        timeDiffMs: bestMatch.timeDiffMs,
        frameDiff,
        matchQuality: matchQualityFromFrameDiff(frameDiff),
      });
    } else {
      extraInSubmission.push({
        submissionIndex: submissionEvent.submissionIndex,
        eventType: submissionEvent.eventType,
        frameTime: submissionEvent.frameTime,
      });
    }
  });

  const missingInSubmission = sortedReference
    .filter((referenceEvent) => !usedReference.has(referenceEvent.referenceIndex))
    .map((referenceEvent) => ({
      referenceIndex: referenceEvent.referenceIndex,
      eventType: referenceEvent.eventType,
      frameTime: referenceEvent.frameTime,
    }));

  const totalReference = sortedReference.length;
  const totalSubmission = sortedSubmission.length;

  return {
    matched,
    extraInSubmission,
    missingInSubmission,
    summary: {
      totalReference,
      totalSubmission,
      matchedCount: matched.length,
      extraCount: extraInSubmission.length,
      missingCount: missingInSubmission.length,
      accuracy:
        totalReference > 0 ? Math.round((matched.length / totalReference) * 100) : null,
    },
  };
}

function buildEventReviewRows(
  submissionEvents = [],
  comparison = null,
  eventValidations = [],
  fps = 25
) {
  const normalizedSubmission = normalizeLabelEvents(submissionEvents);
  const validationMap = new Map(
    (eventValidations || []).map((item) => [item.eventIndex, item])
  );

  const matchBySubmission = new Map(
    (comparison?.matched || []).map((item) => [item.submissionIndex, item])
  );
  const extraSet = new Set(
    (comparison?.extraInSubmission || []).map((item) => item.submissionIndex)
  );

  return normalizedSubmission.map((event, eventIndex) => {
    const match = matchBySubmission.get(eventIndex);
    const validation = validationMap.get(eventIndex);

    let comparisonStatus = null;
    if (comparison) {
      if (match) {
        comparisonStatus = comparisonStatusFromMatch(match);
      } else if (extraSet.has(eventIndex)) {
        comparisonStatus = 'extra';
      } else {
        comparisonStatus = 'unmatched';
      }
    }

    return {
      eventIndex,
      event,
      comparisonStatus,
      frameDiff: match?.frameDiff ?? null,
      match,
      validation: validation || { eventIndex, status: 'pending', notes: '' },
    };
  });
}

module.exports = {
  DEFAULT_TOLERANCE_MS,
  getFrameDiff,
  matchQualityFromFrameDiff,
  comparisonStatusFromMatch,
  compareAnnotations,
  buildEventReviewRows,
};
