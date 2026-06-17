const DEFAULT_TOLERANCE_MS = 200;

function compareAnnotations(submissionEvents = [], referenceEvents = [], toleranceMs = DEFAULT_TOLERANCE_MS) {
  const sortedSubmission = [...submissionEvents]
    .map((event, submissionIndex) => ({ ...event, submissionIndex }))
    .sort((a, b) => a.frameTime - b.frameTime);

  const sortedReference = [...referenceEvents]
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

      if (timeDiffMs <= toleranceMs && (!bestMatch || timeDiffMs < bestMatch.timeDiffMs)) {
        bestMatch = {
          referenceEvent,
          timeDiffMs,
        };
      }
    });

    if (bestMatch) {
      usedReference.add(bestMatch.referenceEvent.referenceIndex);
      matched.push({
        submissionIndex: submissionEvent.submissionIndex,
        referenceIndex: bestMatch.referenceEvent.referenceIndex,
        eventType: submissionEvent.eventType,
        submissionTime: submissionEvent.frameTime,
        referenceTime: bestMatch.referenceEvent.frameTime,
        timeDiffMs: bestMatch.timeDiffMs,
        matchQuality: bestMatch.timeDiffMs <= 40 ? 'exact' : 'close',
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

function buildEventReviewRows(submissionEvents = [], comparison = null, eventValidations = []) {
  const validationMap = new Map(
    (eventValidations || []).map((item) => [item.eventIndex, item])
  );

  const matchBySubmission = new Map(
    (comparison?.matched || []).map((item) => [item.submissionIndex, item])
  );
  const extraSet = new Set(
    (comparison?.extraInSubmission || []).map((item) => item.submissionIndex)
  );

  return submissionEvents.map((event, eventIndex) => {
    const match = matchBySubmission.get(eventIndex);
    const validation = validationMap.get(eventIndex);

    let comparisonStatus = null;
    if (comparison) {
      if (match) {
        comparisonStatus = match.matchQuality === 'exact' ? 'match' : 'close';
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
      match,
      validation: validation || { eventIndex, status: 'pending', notes: '' },
    };
  });
}

module.exports = {
  DEFAULT_TOLERANCE_MS,
  compareAnnotations,
  buildEventReviewRows,
};
