const { getFrameNumber, toDisplayFrame } = require('./frameTime');
const { FPS } = require('../config/frameOffsets');
const { validateEventSpacing } = require('./eventSpacingValidation');

const RECOVERY_PASS_RECEIVED = new Set(['Recovery', 'Pass Received']);
const GAMEPLAY_INSIDE_HIGHLIGHT = new Set([
  'Pass',
  'Pass Received',
  'Recovery',
  'Tackle',
  'Interception',
  'Interception 2',
  'Ball Out of Play',
  'Clearance',
  'Take on',
  'Take on End',
  'Block',
  'Aerial Duel',
  'Shot',
  'Save',
  'Foul',
  'Goal',
  'Referee',
]);
const CONTINUATION_AFTER_FOUL = new Set([
  'Pass',
  'Pass Received',
  'Recovery',
  'Shot',
  'Take on',
  'Take on End',
  'Interception',
  'Interception 2',
]);
const STOPPAGE_BEFORE_REFEREE = new Set(['Foul', 'Ball Out of Play', 'Goal']);

const ADVANTAGE_LOOKAHEAD_FRAMES = 50;

function buildEventFrames(events, fps = FPS) {
  return (events || []).map((event, index) => ({
    index,
    eventType: event.eventType,
    frame: getFrameNumber(event.frameTime, fps),
    frameTime: event.frameTime,
  }));
}

function validateFirstEvent(items) {
  if (!items.length) return [];
  const first = [...items].sort((a, b) => a.frame - b.frame || a.index - b.index)[0];
  if (!RECOVERY_PASS_RECEIVED.has(first.eventType)) return [];
  return [
    {
      kind: 'first_event_recovery_pass_received',
      severity: 'error',
      events: [first],
      message: `${first.eventType} cannot be the first event in the clip — the first mark must be another event type (often Pass, Ball Out of Play, Highlight Start, or Tackle)`,
    },
  ];
}

function validateAfterHighlightEnd(items) {
  const issues = [];
  const sorted = [...items].sort((a, b) => a.frame - b.frame || a.index - b.index);

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (current.eventType !== 'Highlight End') continue;
    if (!RECOVERY_PASS_RECEIVED.has(next.eventType)) continue;

    issues.push({
      kind: 'after_highlight_end_recovery_pass_received',
      severity: 'error',
      events: [current, next],
      message: `${next.eventType} must not come immediately after Highlight End (frame ${toDisplayFrame(current.frame)}) — remove it or extend the highlight segment to include it`,
    });
  }

  return issues;
}

function validateGameplayInsideHighlight(items) {
  const issues = [];
  const starts = items
    .filter((item) => item.eventType === 'Highlight Start')
    .sort((a, b) => a.frame - b.frame || a.index - b.index);

  for (const start of starts) {
    const end = items
      .filter((item) => item.eventType === 'Highlight End' && item.frame > start.frame)
      .sort((a, b) => a.frame - b.frame || a.index - b.index)[0];

    if (!end) {
      issues.push({
        kind: 'highlight_unclosed',
        severity: 'error',
        events: [start],
        message: `Highlight Start at frame ${toDisplayFrame(start.frame)} has no matching Highlight End — add Highlight End before live play resumes`,
      });
      continue;
    }

    const inside = items.filter(
      (item) =>
        item.frame > start.frame &&
        item.frame < end.frame &&
        GAMEPLAY_INSIDE_HIGHLIGHT.has(item.eventType)
    );

    for (const event of inside) {
      issues.push({
        kind: 'gameplay_inside_highlight',
        severity: 'error',
        events: [start, event, end],
        message: `${event.eventType} at frame ${toDisplayFrame(event.frame)} sits inside highlight segment (frames ${toDisplayFrame(start.frame)}–${toDisplayFrame(end.frame)}) — widen Highlight Start/End or move this event outside the replay/non-board segment`,
      });
    }
  }

  return issues;
}

function validatePassPassReceivedPattern(items) {
  const issues = [];
  const sorted = [...items].sort((a, b) => a.frame - b.frame || a.index - b.index);
  const pattern = ['Pass', 'Pass', 'Pass Received', 'Pass Received'];

  for (let i = 0; i <= sorted.length - pattern.length; i += 1) {
    const slice = sorted.slice(i, i + pattern.length);
    const matches = slice.every((item, idx) => item.eventType === pattern[idx]);
    if (!matches) continue;

    issues.push({
      kind: 'bad_pass_pass_received_chain',
      severity: 'bad',
      events: slice,
      message: `BAD pattern: Pass → Pass → Pass Received → Pass Received (frames ${slice.map((e) => toDisplayFrame(e.frame)).join(', ')}) — review each mark; this chain is usually wrong`,
    });
  }

  return issues;
}

function validateFoulAdvantage(items) {
  const issues = [];
  const sorted = [...items].sort((a, b) => a.frame - b.frame || a.index - b.index);

  for (const foul of sorted.filter((item) => item.eventType === 'Foul')) {
    const following = sorted.filter(
      (item) => item.frame > foul.frame && item.frame <= foul.frame + ADVANTAGE_LOOKAHEAD_FRAMES
    );

    const hasReferee = following.some((item) => item.eventType === 'Referee');
    if (hasReferee) continue;

    const continuesPlay = following.some((item) => CONTINUATION_AFTER_FOUL.has(item.eventType));
    if (!continuesPlay) continue;

    issues.push({
      kind: 'foul_advantage_play_continues',
      severity: 'error',
      events: [foul, ...following.filter((item) => CONTINUATION_AFTER_FOUL.has(item.eventType)).slice(0, 1)],
      message: `Foul at frame ${toDisplayFrame(foul.frame)} but play continues without Referee — remove Foul (advantage) and do not add Referee unless the whistle stops play`,
    });
  }

  return issues;
}

function validateRefereeWithoutStoppageCause(items) {
  const issues = [];
  const sorted = [...items].sort((a, b) => a.frame - b.frame || a.index - b.index);
  const LOOKBACK = 100;

  for (const ref of sorted.filter((item) => item.eventType === 'Referee')) {
    const before = sorted.filter(
      (item) => item.frame < ref.frame && item.frame >= ref.frame - LOOKBACK
    );
    const hasCause = before.some((item) => STOPPAGE_BEFORE_REFEREE.has(item.eventType));
    if (hasCause) continue;

    issues.push({
      kind: 'referee_without_stoppage_cause',
      severity: 'warning',
      events: [ref],
      message: `Referee at frame ${toDisplayFrame(ref.frame)} with no recent Foul, Ball Out of Play, or Goal — OK for offside/indirect stoppages; confirm the whistle actually stopped play`,
    });
  }

  return issues;
}

function validateLabelingRules(events, fps = FPS) {
  const items = buildEventFrames(events, fps);
  const issues = [
    ...validateFirstEvent(items),
    ...validateAfterHighlightEnd(items),
    ...validateGameplayInsideHighlight(items),
    ...validatePassPassReceivedPattern(items),
    ...validateFoulAdvantage(items),
    ...validateRefereeWithoutStoppageCause(items),
  ];

  const blocking = issues.filter((issue) => issue.severity !== 'warning');
  const affectedIndices = [...new Set(issues.flatMap((issue) => issue.events.map((e) => e.index)))];

  return {
    valid: blocking.length === 0,
    issues,
    affectedIndices,
    blockingCount: blocking.length,
    warningCount: issues.length - blocking.length,
  };
}

function mergeLabelingValidations(spacingResult, rulesResult) {
  const issues = [...(spacingResult?.issues || []), ...(rulesResult?.issues || [])];
  const affectedIndices = [
    ...new Set([
      ...(spacingResult?.affectedIndices || []),
      ...(rulesResult?.affectedIndices || []),
    ]),
  ];

  return {
    valid: Boolean(spacingResult?.valid) && Boolean(rulesResult?.valid),
    issues,
    affectedIndices,
  };
}

function validateSubmissionLabeling(events, fps = FPS) {
  const spacing = validateEventSpacing(events, fps);
  const rules = validateLabelingRules(events, fps);
  return mergeLabelingValidations(spacing, rules);
}

module.exports = {
  validateLabelingRules,
  validateSubmissionLabeling,
  buildEventFrames,
  RECOVERY_PASS_RECEIVED,
  GAMEPLAY_INSIDE_HIGHLIGHT,
};
