import { FPS } from '../config/frameOffsets';
import { getFrameNumber, toDisplayFrame } from './frameTime';
import { validateSameFrameOnly } from './eventSpacingValidation';

const MIN_GAP_FRAMES = 2;
const MIN_PAIR_FRAMES = 6;
const REFEREE_MIN_FRAMES = 4;
const TACKLE_FOUL_LOOKBACK_FRAMES = 24;
const TACKLE_FOUL_VALID_GAPS = new Set([4, 6, 8, 10, 12]);
const REFEREE_MAX_FRAMES = 150;
const TAKE_ON_RECOMMEND_FRAMES = 100;

const RECOVERY_TRIGGERS = new Set(['TACKLE', 'AERIAL_DUEL', 'INTERCEPTION', 'CLEARANCE']);
export const BLOCKING_SEVERITIES = new Set(['critical', 'very_bad', 'bad']);

function toLabelKey(eventType) {
  return String(eventType || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

function buildEventFrames(events, fps = FPS) {
  return (events || []).map((event, index) => ({
    index,
    eventType: event.eventType,
    labelKey: toLabelKey(event.eventType),
    frame: getFrameNumber(event.frameTime, fps),
    frameTime: event.frameTime,
  }));
}

function makeIssue(rule, severity, category, message, ...eventItems) {
  return {
    kind: rule,
    severity,
    category,
    events: eventItems.filter(Boolean),
    message,
  };
}

function checkMarkerPairing(items, startLabel, endLabel, humanName) {
  const markers = [];
  for (const item of items) {
    if (item.labelKey === startLabel) markers.push({ frame: item.frame, tie: 0, kind: 'START', item });
    else if (item.labelKey === endLabel) markers.push({ frame: item.frame, tie: 1, kind: 'END', item });
  }
  if (!markers.length) return [];

  markers.sort((a, b) => a.frame - b.frame || a.tie - b.tie);
  const findings = [];
  const stack = [];

  for (const marker of markers) {
    if (marker.kind === 'START') {
      stack.push(marker);
    } else if (!stack.length) {
      findings.push(
        makeIssue(
          humanName,
          'critical',
          'Critical',
          `${endLabel.replace(/_/g, ' ')} without matching ${startLabel.replace(/_/g, ' ')}`,
          marker.item
        )
      );
    } else {
      const start = stack.pop();
      if (marker.frame < start.frame) {
        findings.push(
          makeIssue(
            humanName,
            'critical',
            'Critical',
            `${endLabel.replace(/_/g, ' ')} is before ${startLabel.replace(/_/g, ' ')}`,
            start.item,
            marker.item
          )
        );
      }
    }
  }

  for (const start of stack) {
    findings.push(
      makeIssue(
        humanName,
        'critical',
        'Critical',
        `${startLabel.replace(/_/g, ' ')} without matching ${endLabel.replace(/_/g, ' ')}`,
        start.item
      )
    );
  }

  return findings;
}

function highlightPairs(items) {
  const markers = [];
  for (const item of items) {
    if (item.labelKey === 'HIGHLIGHT_START') markers.push({ frame: item.frame, tie: 0, kind: 'START' });
    else if (item.labelKey === 'HIGHLIGHT_END') markers.push({ frame: item.frame, tie: 1, kind: 'END' });
  }
  markers.sort((a, b) => a.frame - b.frame || a.tie - b.tie);

  const pairs = [];
  const stack = [];
  for (const marker of markers) {
    if (marker.kind === 'START') stack.push(marker.frame);
    else if (stack.length) {
      const startFrame = stack.pop();
      if (marker.frame >= startFrame) pairs.push([startFrame, marker.frame]);
    }
  }
  return pairs;
}

function isInsideHighlight(frame, pairs) {
  return pairs.some(([start, end]) => frame >= start && frame <= end);
}

function stripHighlightEvents(items, pairs) {
  if (!pairs.length) return [...items];
  return items.filter((item) => !isInsideHighlight(item.frame, pairs));
}

function highlightBetween(frameA, frameB, pairs) {
  const lo = Math.min(frameA, frameB);
  const hi = Math.max(frameA, frameB);
  return pairs.some(([start, end]) => lo < start && end < hi);
}

function checkMinGap(items) {
  const sorted = [...items].sort((a, b) => a.frame - b.frame || a.index - b.index);
  const findings = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const gap = b.frame - a.frame;
    if (gap < MIN_GAP_FRAMES) {
      findings.push(
        makeIssue(
          'min_gap',
          'critical',
          'Critical',
          `gap=${gap} frame(s) (< ${MIN_GAP_FRAMES}) between ${a.eventType} and ${b.eventType}`,
          a,
          b
        )
      );
    }
  }
  return findings;
}

function takeOnPairs(items) {
  const markers = [];
  for (const item of items) {
    if (item.labelKey === 'TAKE_ON') markers.push({ frame: item.frame, tie: 0, kind: 'START', item });
    else if (item.labelKey === 'TAKE_ON_END') markers.push({ frame: item.frame, tie: 1, kind: 'END', item });
  }
  markers.sort((a, b) => a.frame - b.frame || a.tie - b.tie);

  const pairs = [];
  const stack = [];
  for (const marker of markers) {
    if (marker.kind === 'START') stack.push(marker);
    else if (stack.length) {
      const start = stack.pop();
      if (marker.frame >= start.frame) pairs.push([start, marker]);
    }
  }
  return pairs;
}

function checkTakeOnTiming(items) {
  const findings = [];
  for (const [start, end] of takeOnPairs(items)) {
    const frames = end.frame - start.frame;
    if (frames < MIN_PAIR_FRAMES) {
      findings.push(
        makeIssue(
          'take_on_timing',
          'critical',
          'Critical',
          `Take on → Take on End: ${frames} frame(s) (< ${MIN_PAIR_FRAMES})`,
          start.item,
          end.item
        )
      );
    } else if (frames % 2 !== 0) {
      findings.push(
        makeIssue(
          'take_on_timing',
          'critical',
          'Critical',
          `Take on → Take on End: ${frames} frame(s) (must be even)`,
          start.item,
          end.item
        )
      );
    }
  }
  return findings;
}

function checkTackleFoul(items) {
  const bad = [];
  const suspicious = [];
  const validGaps = [...TACKLE_FOUL_VALID_GAPS].sort((a, b) => a - b).join(', ');
  const tackles = items
    .filter((item) => item.labelKey === 'TACKLE')
    .sort((a, b) => a.frame - b.frame || a.index - b.index);
  const sorted = [...items].sort((a, b) => a.frame - b.frame || a.index - b.index);

  for (let i = 0; i < sorted.length; i += 1) {
    const foul = sorted[i];
    if (foul.labelKey !== 'FOUL') continue;
    if (i > 0 && sorted[i - 1].labelKey === 'PASS') continue;

    const preceding = tackles
      .filter((t) => t.frame <= foul.frame && foul.frame - t.frame <= TACKLE_FOUL_LOOKBACK_FRAMES)
      .map((t) => t.frame);

    if (!preceding.length) {
      suspicious.push(
        makeIssue(
          'tackle_foul',
          'suspicious',
          'Suspicious',
          `Foul with no Tackle within ${TACKLE_FOUL_LOOKBACK_FRAMES} frames before it`,
          foul
        )
      );
      continue;
    }

    const tackleFrame = Math.max(...preceding);
    const tackle = tackles.find((t) => t.frame === tackleFrame);
    const frames = foul.frame - tackleFrame;
    if (!TACKLE_FOUL_VALID_GAPS.has(frames)) {
      bad.push(
        makeIssue(
          'tackle_foul',
          'bad',
          'Bad',
          `Tackle → Foul: ${frames} frame(s) (must be ${validGaps})`,
          tackle,
          foul
        )
      );
    }
  }

  return { bad, suspicious };
}

function refereeFollowupAfter(items, afterFrame) {
  const refs = items
    .filter(
      (item) =>
        item.labelKey === 'REFEREE' &&
        item.frame > afterFrame &&
        item.frame - afterFrame <= REFEREE_MAX_FRAMES
    )
    .map((item) => item.frame);
  return refs.length ? Math.min(...refs) : null;
}

function checkRefereeFollowup(items) {
  const bad = [];
  const suspicious = [];
  const triggers = items
    .filter((item) => item.labelKey === 'BALL_OUT_OF_PLAY' || item.labelKey === 'FOUL')
    .sort((a, b) => a.frame - b.frame || a.index - b.index);

  for (const trigger of triggers) {
    const refFrame = refereeFollowupAfter(items, trigger.frame);
    const triggerName = trigger.eventType;
    if (refFrame == null) {
      suspicious.push(
        makeIssue(
          'referee_followup',
          'suspicious',
          'Suspicious',
          `${triggerName} not followed by Referee within ${REFEREE_MAX_FRAMES} frames`,
          trigger
        )
      );
      continue;
    }

    const ref = items.find((item) => item.frame === refFrame && item.labelKey === 'REFEREE');
    const frames = refFrame - trigger.frame;
    if (frames < REFEREE_MIN_FRAMES) {
      bad.push(
        makeIssue(
          'referee_followup',
          'critical',
          'Critical',
          `${triggerName} → Referee: ${frames} frame(s) (< ${REFEREE_MIN_FRAMES})`,
          trigger,
          ref
        )
      );
    } else if (frames % 2 !== 0) {
      bad.push(
        makeIssue(
          'referee_followup',
          'critical',
          'Critical',
          `${triggerName} → Referee: ${frames} frame(s) (must be even)`,
          trigger,
          ref
        )
      );
    }
  }

  return { bad, suspicious };
}

function recoveryCheckSkipped(triggerKey, triggerFrame, next) {
  const nextKey = next.labelKey;
  const gap = next.frame - triggerFrame;

  if (triggerKey === 'TACKLE' && nextKey === 'TACKLE') return true;
  if (triggerKey === 'TACKLE' && nextKey === 'FOUL') return true;
  if (triggerKey === 'TACKLE' && nextKey === 'CLEARANCE') return true;
  if (triggerKey === 'TACKLE' && (nextKey === 'TAKE_ON' || nextKey === 'TAKE_ON_END')) return true;
  if ((triggerKey === 'TACKLE' || triggerKey === 'INTERCEPTION') && nextKey === 'PASS') return true;
  if (triggerKey === 'INTERCEPTION' && nextKey === 'CLEARANCE') return true;
  if (triggerKey === 'CLEARANCE' && nextKey === 'AERIAL_DUEL') return true;
  if (triggerKey === 'CLEARANCE' && nextKey === 'PASS_RECEIVED') return true;
  if (triggerKey === 'CLEARANCE' && nextKey === 'FOUL') return true;
  if (triggerKey === 'CLEARANCE' && nextKey === 'SHOT') return true;
  if (triggerKey === 'CLEARANCE' && nextKey === 'REFEREE') return true;
  if (triggerKey === 'CLEARANCE' && nextKey === 'CLEARANCE') return true;
  if (triggerKey === 'AERIAL_DUEL' && nextKey === 'BALL_OUT_OF_PLAY') return true;
  if (triggerKey === 'AERIAL_DUEL' && nextKey === 'AERIAL_DUEL') return true;
  if (triggerKey === 'AERIAL_DUEL' && nextKey === 'CLEARANCE') return true;
  if (triggerKey === 'AERIAL_DUEL' && nextKey === 'SHOT') return true;
  if (triggerKey === 'AERIAL_DUEL' && nextKey === 'PASS' && (gap === 2 || gap === 3)) return true;
  if (RECOVERY_TRIGGERS.has(triggerKey) && nextKey === 'HIGHLIGHT_START') return true;
  if (
    (triggerKey === 'TACKLE' || triggerKey === 'CLEARANCE' || triggerKey === 'INTERCEPTION') &&
    nextKey === 'BALL_OUT_OF_PLAY'
  ) {
    return true;
  }
  return false;
}

function checkRecovery(items, pairs) {
  const veryBad = [];
  const suspicious = [];
  const sorted = [...items].sort((a, b) => a.frame - b.frame || a.index - b.index);

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i];
    if (!RECOVERY_TRIGGERS.has(current.labelKey)) continue;
    const next = sorted[i + 1];
    if (next.labelKey === 'RECOVERY') continue;
    if (highlightBetween(current.frame, next.frame, pairs)) continue;
    if (recoveryCheckSkipped(current.labelKey, current.frame, next)) continue;

    const finding = makeIssue(
      'recovery',
      current.labelKey === 'CLEARANCE' ? 'very_bad' : 'suspicious',
      current.labelKey === 'CLEARANCE' ? 'Very bad' : 'Suspicious',
      `${current.eventType} not followed by Recovery (next: ${next.eventType})`,
      current,
      next
    );

    if (current.labelKey === 'CLEARANCE') veryBad.push(finding);
    else suspicious.push(finding);
  }

  return { veryBad, suspicious };
}

function checkForbiddenAtStart(items) {
  if (!items.length) return [];
  const first = [...items].sort((a, b) => a.frame - b.frame || a.index - b.index)[0];
  if (first.labelKey !== 'PASS_RECEIVED' && first.labelKey !== 'RECOVERY') return [];
  return [
    makeIssue(
      'forbidden_at_start',
      'very_bad',
      'Very bad',
      `${first.eventType} must not be the first event`,
      first
    ),
  ];
}

function checkForbiddenAfterHighlightEnd(fullItems) {
  const findings = [];
  const sorted = [...fullItems].sort((a, b) => a.frame - b.frame || a.index - b.index);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    if (sorted[i].labelKey !== 'HIGHLIGHT_END') continue;
    const next = sorted[i + 1];
    if (next.labelKey !== 'PASS_RECEIVED' && next.labelKey !== 'RECOVERY') continue;
    findings.push(
      makeIssue(
        'after_highlight_end',
        'very_bad',
        'Very bad',
        `${next.eventType} must not immediately follow Highlight End`,
        sorted[i],
        next
      )
    );
  }
  return findings;
}

function checkTakeOnRecommended(items, pairs) {
  const findings = [];
  const sorted = [...items].sort((a, b) => a.frame - b.frame || a.index - b.index);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i];
    if (current.labelKey !== 'PASS_RECEIVED' && current.labelKey !== 'RECOVERY') continue;
    const next = sorted[i + 1];
    if (next.labelKey === 'TAKE_ON' || next.labelKey === 'TAKE_ON_END') continue;
    if (highlightBetween(current.frame, next.frame, pairs)) continue;
    const gapFrames = next.frame - current.frame;
    if (gapFrames > TAKE_ON_RECOMMEND_FRAMES) {
      findings.push(
        makeIssue(
          'take_on_recommended',
          'recommended',
          'Recommended',
          `${current.eventType} is ${gapFrames} frames before ${next.eventType} (> ${TAKE_ON_RECOMMEND_FRAMES}); Take on may be missing`,
          current,
          next
        )
      );
    }
  }
  return findings;
}

function checkConsecutivePass(items, pairs) {
  const findings = [];
  const sorted = [...items].sort((a, b) => a.frame - b.frame || a.index - b.index);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (a.labelKey !== 'PASS' || b.labelKey !== 'PASS') continue;
    if (highlightBetween(a.frame, b.frame, pairs)) continue;
    findings.push(
      makeIssue(
        'consecutive_pass',
        'suspicious',
        'Suspicious',
        `Pass immediately followed by Pass (gap=${b.frame - a.frame} frame(s))`,
        a,
        b
      )
    );
  }
  return findings;
}

function checkPassTackle(items, pairs) {
  const findings = [];
  const sorted = [...items].sort((a, b) => a.frame - b.frame || a.index - b.index);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (a.labelKey !== 'PASS' || b.labelKey !== 'TACKLE') continue;
    if (highlightBetween(a.frame, b.frame, pairs)) continue;
    findings.push(
      makeIssue(
        'pass_tackle',
        'suspicious',
        'Suspicious',
        `Pass immediately followed by Tackle (gap=${b.frame - a.frame} frame(s))`,
        a,
        b
      )
    );
  }
  return findings;
}

export function validateLabelingRules(events, fps = FPS) {
  const fullItems = buildEventFrames(events, fps);
  if (!fullItems.length) {
    return { valid: true, issues: [], affectedIndices: [], blockingCount: 0, warningCount: 0 };
  }

  const issues = [];

  issues.push(
    ...checkMarkerPairing(fullItems, 'HIGHLIGHT_START', 'HIGHLIGHT_END', 'highlight_pairing')
  );
  issues.push(...checkForbiddenAfterHighlightEnd(fullItems));

  const pairs = highlightPairs(fullItems);
  const stripped = stripHighlightEvents(fullItems, pairs);

  issues.push(...checkMarkerPairing(stripped, 'TAKE_ON', 'TAKE_ON_END', 'take_on_pairing'));
  issues.push(...checkMinGap(stripped));
  issues.push(...checkTakeOnTiming(stripped));

  const tackleFoul = checkTackleFoul(stripped);
  issues.push(...tackleFoul.bad, ...tackleFoul.suspicious);

  const referee = checkRefereeFollowup(stripped);
  issues.push(...referee.bad, ...referee.suspicious);

  const recovery = checkRecovery(stripped, pairs);
  issues.push(...recovery.veryBad, ...recovery.suspicious);

  issues.push(...checkForbiddenAtStart(stripped));
  issues.push(...checkConsecutivePass(stripped, pairs));
  issues.push(...checkPassTackle(stripped, pairs));
  issues.push(...checkTakeOnRecommended(stripped, pairs));

  const blocking = issues.filter((issue) => BLOCKING_SEVERITIES.has(issue.severity));
  const affectedIndices = [...new Set(issues.flatMap((issue) => issue.events.map((e) => e.index)))];

  return {
    valid: blocking.length === 0,
    issues,
    affectedIndices,
    blockingCount: blocking.length,
    warningCount: issues.length - blocking.length,
  };
}

export function mergeLabelingValidations(...results) {
  const issues = results.flatMap((result) => result?.issues || []);
  const affectedIndices = [...new Set(results.flatMap((result) => result?.affectedIndices || []))];
  const valid = results.every((result) => result?.valid !== false);

  return { valid, issues, affectedIndices };
}

export function validateSubmissionLabeling(events, fps = FPS) {
  const sameFrame = validateSameFrameOnly(events, fps);
  const rules = validateLabelingRules(events, fps);
  return mergeLabelingValidations(sameFrame, rules);
}
