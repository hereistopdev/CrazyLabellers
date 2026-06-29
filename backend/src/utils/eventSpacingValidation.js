const { getFrameNumber, toDisplayFrame } = require('./frameTime');
const { FPS } = require('../config/frameOffsets');

/** Max frame gap for paired-event even-frame timing rules (Take on → End, Foul → Referee, etc.). */
const PAIR_MAX_GAP = 100;

/** Paired events: gap = second.frame - first.frame must be >= minGap and even (when gap ≤ PAIR_MAX_GAP). */
const PAIR_TIMING_RULES = [
  {
    id: 'take-on-end',
    first: 'Take on',
    second: 'Take on End',
    minGap: 6,
    label: 'Take on → Take on End',
  },
  {
    id: 'tackle-foul',
    first: 'Tackle',
    second: 'Foul',
    minGap: 6,
    label: 'Tackle → Foul',
  },
  {
    id: 'foul-referee',
    first: 'Foul',
    second: 'Referee',
    minGap: 6,
    label: 'Foul → Referee',
  },
  {
    id: 'ball-out-referee',
    first: 'Ball Out of Play',
    second: 'Referee',
    minGap: 6,
    label: 'Ball Out of Play → Referee',
  },
];

function buildEventFrames(events, fps = FPS) {
  return (events || []).map((event, index) => ({
    index,
    eventType: event.eventType,
    frame: getFrameNumber(event.frameTime, fps),
    frameTime: event.frameTime,
  }));
}

function isValidPairGap(gap, minGap = 6) {
  if (gap < minGap) return false;
  if (gap > PAIR_MAX_GAP) return true;
  return gap % 2 === 0;
}

function pairTimingMessage(rule, first, second, gap) {
  const problems = [];
  if (gap < rule.minGap) {
    problems.push(`need at least ${rule.minGap} frames between them (currently ${gap})`);
  } else if (gap <= PAIR_MAX_GAP && gap % 2 !== 0) {
    problems.push(`gap must be an even number of frames when ≤ ${PAIR_MAX_GAP} apart (currently ${gap})`);
  }
  const detail = problems.length ? problems.join('; ') : 'spacing rule violated';
  return `${rule.label}: ${first.eventType} at frame ${toDisplayFrame(first.frame)} → ${second.eventType} at frame ${toDisplayFrame(second.frame)} — ${detail}`;
}

function validatePairTiming(items) {
  const issues = [];

  for (const rule of PAIR_TIMING_RULES) {
    const firstItems = items
      .filter((item) => item.eventType === rule.first)
      .sort((a, b) => a.frame - b.frame || a.index - b.index);
    const secondItems = items
      .filter((item) => item.eventType === rule.second)
      .sort((a, b) => a.frame - b.frame || a.index - b.index);
    const usedSecond = new Set();

    for (const first of firstItems) {
      const second = secondItems.find(
        (candidate) => !usedSecond.has(candidate.index) && candidate.frame > first.frame
      );
      if (!second) continue;

      usedSecond.add(second.index);
      const gap = second.frame - first.frame;
      if (gap > PAIR_MAX_GAP) continue;

      if (!isValidPairGap(gap, rule.minGap)) {
        issues.push({
          kind: 'pair_timing',
          ruleId: rule.id,
          gap,
          frameA: first.frame,
          frameB: second.frame,
          events: [first, second],
          message: pairTimingMessage(rule, first, second, gap),
        });
      }
    }
  }

  return issues;
}

function validateEventSpacing(events, fps = FPS) {
  return validateSameFrameOnly(events, fps);
}

function validateSameFrameOnly(events, fps = FPS) {
  const items = buildEventFrames(events, fps);
  const issues = [];

  if (items.length === 0) {
    return { valid: true, issues: [], affectedIndices: [] };
  }

  const byFrame = new Map();
  for (const item of items) {
    if (!byFrame.has(item.frame)) byFrame.set(item.frame, []);
    byFrame.get(item.frame).push(item);
  }

  for (const [frame, frameItems] of byFrame) {
    if (frameItems.length > 1) {
      issues.push({
        kind: 'same_frame',
        severity: 'critical',
        category: 'Critical',
        frame,
        events: frameItems,
        message: `Frame ${toDisplayFrame(frame)} has ${frameItems.length} events (${frameItems.map((i) => i.eventType).join(', ')}) — only one event per frame`,
      });
    }
  }

  const affectedIndices = [...new Set(issues.flatMap((issue) => issue.events.map((e) => e.index)))];

  return {
    valid: issues.length === 0,
    issues,
    affectedIndices,
  };
}

function getEventSpacingRuleSummary() {
  return 'Only one event per frame, with at least two frames (80 ms) between consecutive events. Highlight segments are excluded from gameplay checks.';
}

function getEventPairTimingRuleSummary() {
  return 'Take on → Take on End: ≥ 6 even frames. Tackle → Foul: gap must be 4, 6, 8, 10, or 12 frames. Foul / Ball Out of Play → Referee: ≥ 4 even frames within 150 frames.';
}

function getTackleFoulRuleSummary() {
  return [
    'Tackle + Foul + Referee: ball carrier (after Pass Received / Recovery) is tackled and the referee stops play.',
    'Tackle only: tackle attempt while play continues (no Referee whistle for that challenge).',
    'Foul only: foul when the passer no longer has the ball — do not mark Foul on advantage (play continues).',
  ].join(' ');
}

module.exports = {
  PAIR_TIMING_RULES,
  PAIR_MAX_GAP,
  validateEventSpacing,
  validateSameFrameOnly,
  validatePairTiming,
  buildEventFrames,
  getEventSpacingRuleSummary,
  getEventPairTimingRuleSummary,
  getTackleFoulRuleSummary,
};
