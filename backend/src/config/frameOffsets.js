const FPS = 30;

const FRAME_OFFSETS = {
  default: -2,
  Pass: -3,
  'Ball Out of Play': 1,
  Shot: -3,
  Goal: 1,
};

const IMMEDIATE_FOLLOW_UP_OFFSET = 0;

const immediateFollowUpRules = [
  {
    id: 'receive-pass',
    after: 'Pass Received',
    event: 'Pass',
    firstOffset: -2,
    secondOffset: 0,
    title: 'Receive → immediate pass',
    detail:
      'Player receives and plays a one-touch pass. Pass Received at −2 frames; Pass at the touch frame (0).',
  },
  {
    id: 'receive-shot',
    after: 'Pass Received',
    event: 'Shot',
    firstOffset: -2,
    secondOffset: 0,
    title: 'Receive → immediate shot',
    detail:
      'One-touch shot after receiving. Pass Received at −2 frames; Shot at contact frame (0), not −3.',
  },
  {
    id: 'receive-takeon',
    after: 'Pass Received',
    event: 'Take on',
    firstOffset: -2,
    secondOffset: 0,
    title: 'Receive → immediate take on',
    detail:
      'Receiver takes first touch straight at a defender. Pass Received at −2; Take on at first touch (0).',
  },
  {
    id: 'recovery-pass',
    after: 'Recovery',
    event: 'Pass',
    firstOffset: -2,
    secondOffset: 0,
    title: 'Recovery → immediate pass',
    detail:
      'Player picks up loose ball and passes without settling. Recovery at −2; Pass at contact (0).',
  },
  {
    id: 'interception-pass',
    after: 'Interception',
    event: 'Pass',
    firstOffset: -2,
    secondOffset: 0,
    title: 'Interception → immediate pass',
    detail:
      'Cut-out followed by instant outlet pass. Interception at −2; Pass at contact (0).',
  },
  {
    id: 'recovery-clearance',
    after: 'Recovery',
    event: 'Clearance',
    firstOffset: -2,
    secondOffset: 0,
    title: 'Recovery → immediate clearance',
    detail:
      'Loose ball cleared on first touch. Recovery at −2; Clearance at contact (0).',
  },
  {
    id: 'interception-shot',
    after: 'Interception',
    event: 'Shot',
    firstOffset: -2,
    secondOffset: 0,
    title: 'Interception → immediate shot',
    detail:
      'Win ball and shoot in one motion. Interception at −2; Shot at contact (0).',
  },
];

const followUpLookup = new Map(
  immediateFollowUpRules.map((r) => [`${r.after}|${r.event}`, r])
);

function getFrameOffset(eventType) {
  return FRAME_OFFSETS[eventType] ?? FRAME_OFFSETS.default;
}

function getImmediateFollowUpRule(afterEvent, eventType) {
  return followUpLookup.get(`${afterEvent}|${eventType}`) ?? null;
}

function resolveFrameOffset(eventType, { immediateFollowUp = false, afterEvent = null } = {}) {
  if (immediateFollowUp) {
    if (afterEvent) {
      const rule = getImmediateFollowUpRule(afterEvent, eventType);
      if (rule) return rule.secondOffset;
    }
    return IMMEDIATE_FOLLOW_UP_OFFSET;
  }
  return getFrameOffset(eventType);
}

function frameToSeconds(frames, fps = FPS) {
  return frames / fps;
}

function applyFrameOffset(timeSeconds, eventType, options = {}) {
  const offset = resolveFrameOffset(eventType, options);
  const adjusted = timeSeconds + frameToSeconds(offset, fps);
  return Math.max(0, parseFloat(adjusted.toFixed(3)));
}

function formatOffset(offset) {
  if (offset > 0) return `+${offset}`;
  return String(offset);
}

const frameOffsetRules = [
  { event: 'Default (all other events)', offset: -2, detail: 'Mark 2 frames before the visible moment.' },
  {
    event: 'Pass',
    offset: -3,
    detail: 'Mark 3 frames before the ball leaves the passer.',
    exception: 'Use 0 frames if immediate one-touch pass after Pass Received.',
  },
  {
    event: 'Shot',
    offset: -3,
    detail: 'Mark 3 frames before contact with the ball.',
    exception: 'Use 0 frames if one-touch shot right after receive/interception.',
  },
  { event: 'Ball Out of Play', offset: 1, detail: 'Mark 1 frame after the whole ball crosses the line.' },
  { event: 'Goal', offset: 1, detail: 'Mark 1 frame after the whole ball crosses the goal line.' },
];

module.exports = {
  FPS,
  FRAME_OFFSETS,
  IMMEDIATE_FOLLOW_UP_OFFSET,
  immediateFollowUpRules,
  getFrameOffset,
  getImmediateFollowUpRule,
  resolveFrameOffset,
  frameToSeconds,
  applyFrameOffset,
  formatOffset,
  frameOffsetRules,
};
