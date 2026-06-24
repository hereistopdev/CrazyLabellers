const { getFrameNumber } = require('./frameTime');
const { FPS } = require('../config/frameOffsets');

/** Paired events: gap = second.frame - first.frame must be >= minGap and even. */
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
  return gap >= minGap && gap % 2 === 0;
}

function pairTimingMessage(rule, first, second, gap) {
  const problems = [];
  if (gap < rule.minGap) {
    problems.push(`gap is ${gap} frames (need ≥ ${rule.minGap})`);
  } else if (gap % 2 !== 0) {
    problems.push(`gap is ${gap} frames (must be an even number)`);
  }
  return `${rule.label}: ${first.eventType} (F${first.frame}) and ${second.eventType} (F${second.frame}) — ${problems.join(' and ')}`;
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
        frame,
        events: frameItems,
        message: `Frame ${frame} has ${frameItems.length} events (${frameItems.map((i) => i.eventType).join(', ')}) — only one event per frame is allowed`,
      });
    }
  }

  const sorted = [...items].sort((a, b) => a.frame - b.frame || a.index - b.index);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const gap = next.frame - current.frame;
    if (gap === 1) {
      issues.push({
        kind: 'adjacent_frames',
        frameA: current.frame,
        frameB: next.frame,
        events: [current, next],
        message: `${current.eventType} (F${current.frame}) and ${next.eventType} (F${next.frame}) are on consecutive frames — leave at least one blank frame between events`,
      });
    }
  }

  issues.push(...validatePairTiming(items));

  const affectedIndices = [...new Set(issues.flatMap((issue) => issue.events.map((e) => e.index)))];

  return {
    valid: issues.length === 0,
    issues,
    affectedIndices,
  };
}

function getEventSpacingRuleSummary() {
  return 'Only one event per frame, with at least one blank frame between any two events.';
}

function getEventPairTimingRuleSummary() {
  return 'Paired timings need a gap of ≥ 6 even frames: Take on → Take on End; Tackle → Foul; Foul → Referee; Ball Out of Play → Referee.';
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
  validateEventSpacing,
  validatePairTiming,
  buildEventFrames,
  getEventSpacingRuleSummary,
  getEventPairTimingRuleSummary,
  getTackleFoulRuleSummary,
};
