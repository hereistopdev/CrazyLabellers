import { FPS } from '../config/frameOffsets';
import { getFrameNumber } from './frameTime';

export const DEFAULT_TOLERANCE_MS = 250;

function getFrameDiffFromTimes(timeA, timeB, fps = FPS) {
  return Math.abs(getFrameNumber(timeA, fps) - getFrameNumber(timeB, fps));
}

export function compareAnnotations(
  submissionEvents = [],
  referenceEvents = [],
  toleranceMs = DEFAULT_TOLERANCE_MS,
  fps = FPS
) {
  const sortedSubmission = submissionEvents
    .map((event, submissionIndex) => ({ ...event, submissionIndex }))
    .sort((a, b) => a.frameTime - b.frameTime);

  const sortedReference = referenceEvents
    .map((event, referenceIndex) => ({ ...event, referenceIndex }))
    .sort((a, b) => a.frameTime - b.frameTime);

  const usedReference = new Set();
  const matched = [];
  const extraInSubmission = [];

  for (const submissionEvent of sortedSubmission) {
    let bestMatch = null;

    for (const referenceEvent of sortedReference) {
      if (usedReference.has(referenceEvent.referenceIndex)) continue;
      if (referenceEvent.eventType !== submissionEvent.eventType) continue;

      const timeDiffMs = Math.abs(
        referenceEvent.frameTime * 1000 - submissionEvent.frameTime * 1000
      );
      const frameDiff = getFrameDiffFromTimes(
        referenceEvent.frameTime,
        submissionEvent.frameTime,
        fps
      );

      if (timeDiffMs <= toleranceMs && (!bestMatch || frameDiff < bestMatch.frameDiff)) {
        bestMatch = { referenceEvent, timeDiffMs, frameDiff };
      }
    }

    if (bestMatch) {
      usedReference.add(bestMatch.referenceEvent.referenceIndex);
      matched.push({
        submissionIndex: submissionEvent.submissionIndex,
        referenceIndex: bestMatch.referenceEvent.referenceIndex,
        frameDiff: bestMatch.frameDiff,
        matchQuality:
          bestMatch.frameDiff <= 0 ? 'exact' : bestMatch.frameDiff === 1 ? 'close' : 'off',
      });
    } else {
      extraInSubmission.push({
        submissionIndex: submissionEvent.submissionIndex,
        eventType: submissionEvent.eventType,
        frameTime: submissionEvent.frameTime,
      });
    }
  }

  const missingInSubmission = sortedReference
    .filter((referenceEvent) => !usedReference.has(referenceEvent.referenceIndex))
    .map((referenceEvent) => ({
      referenceIndex: referenceEvent.referenceIndex,
      eventType: referenceEvent.eventType,
      frameTime: referenceEvent.frameTime,
    }));

  return {
    matched,
    extraInSubmission,
    missingInSubmission,
    summary: {
      matchedCount: matched.length,
      extraCount: extraInSubmission.length,
      missingCount: missingInSubmission.length,
    },
  };
}

export function buildEventReviewRows(submissionEvents = [], comparison = null) {
  const matchBySubmission = new Map(
    (comparison?.matched || []).map((item) => [item.submissionIndex, item])
  );
  const extraSet = new Set(
    (comparison?.extraInSubmission || []).map((item) => item.submissionIndex)
  );

  return (submissionEvents || []).map((event, eventIndex) => {
    const match = matchBySubmission.get(eventIndex);
    let comparisonStatus = null;
    if (comparison) {
      if (match) {
        comparisonStatus =
          match.matchQuality === 'exact'
            ? 'match'
            : match.matchQuality === 'close'
              ? 'close'
              : 'off';
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
    };
  });
}

export function getNewEventIndices(events = [], referenceEvents = [], fps = FPS) {
  if (!referenceEvents?.length || !events?.length) return new Set();
  const comparison = compareAnnotations(events, referenceEvents, DEFAULT_TOLERANCE_MS, fps);
  return new Set(comparison.extraInSubmission.map((item) => item.submissionIndex));
}
