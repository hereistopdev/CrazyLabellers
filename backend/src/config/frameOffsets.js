const FPS = 25;

const FRAME_OFFSETS = {
  Pass: 0,
  Tackle: 0,
  Clearance: 0,
  Block: 0,
  'Aerial Duel': 0,
  Shot: 0,
  Substitution: 0,
  'Highlight Start': 0,
  'Highlight End': 0,
  Referee: 0,
  Invalid: 0,
  'Pass Received': -1,
  Recovery: -1,
  Interception: -1,
  'Ball Out of Play': -1,
  Save: -1,
  Goal: -1,
  'Take on': 1,
  Foul: 1,
};

const FRAME_OFFSET_DEFAULT = 0;
const IMMEDIATE_FOLLOW_UP_OFFSET = 0;

const immediateFollowUpRules = [
  {
    id: 'receive-pass',
    after: 'Pass Received',
    event: 'Pass',
    firstOffset: -1,
    secondOffset: 0,
    title: 'Receive → immediate pass',
    detail:
      'Player receives and plays a one-touch pass. Pass Received at −1 frame; Pass at the touch frame (0).',
  },
  {
    id: 'receive-shot',
    after: 'Pass Received',
    event: 'Shot',
    firstOffset: -1,
    secondOffset: 0,
    title: 'Receive → immediate shot',
    detail:
      'One-touch shot after receiving. Pass Received at −1 frame; Shot at contact frame (0).',
  },
  {
    id: 'receive-takeon',
    after: 'Pass Received',
    event: 'Take on',
    firstOffset: -1,
    secondOffset: 0,
    title: 'Receive → immediate take on',
    detail:
      'Receiver takes first touch straight at a defender. Pass Received at −1; Take on at first touch (0), not +1.',
  },
  {
    id: 'recovery-pass',
    after: 'Recovery',
    event: 'Pass',
    firstOffset: -1,
    secondOffset: 0,
    title: 'Recovery → immediate pass',
    detail:
      'Player picks up loose ball and passes without settling. Recovery at −1; Pass at contact (0).',
  },
  {
    id: 'interception-pass',
    after: 'Interception',
    event: 'Pass',
    firstOffset: -1,
    secondOffset: 0,
    title: 'Interception → immediate pass',
    detail:
      'Cut-out followed by instant outlet pass. Interception at −1; Pass at contact (0).',
  },
  {
    id: 'recovery-clearance',
    after: 'Recovery',
    event: 'Clearance',
    firstOffset: -1,
    secondOffset: 0,
    title: 'Recovery → immediate clearance',
    detail:
      'Loose ball cleared on first touch. Recovery at −1; Clearance at contact (0).',
  },
  {
    id: 'interception-shot',
    after: 'Interception',
    event: 'Shot',
    firstOffset: -1,
    secondOffset: 0,
    title: 'Interception → immediate shot',
    detail:
      'Win ball and shoot in one motion. Interception at −1; Shot at contact (0).',
  },
];

const followUpLookup = new Map(
  immediateFollowUpRules.map((r) => [`${r.after}|${r.event}`, r])
);

function getFrameOffset(eventType) {
  if (Object.prototype.hasOwnProperty.call(FRAME_OFFSETS, eventType)) {
    return FRAME_OFFSETS[eventType];
  }
  return FRAME_OFFSET_DEFAULT;
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
  const adjusted = timeSeconds + frameToSeconds(offset);
  return Math.max(0, parseFloat(adjusted.toFixed(3)));
}

function formatOffset(offset) {
  if (offset > 0) return `+${offset}`;
  return String(offset);
}

const frameOffsetRules = [
  {
    event: '0 frames — contact / visible action',
    offset: 0,
    detail:
      'Pass, Tackle, Clearance, Block, Aerial Duel, Shot, Substitution, Highlight Start, Highlight End, Referee, Invalid',
  },
  {
    event: '−1 frame — slightly before moment',
    offset: -1,
    detail: 'Pass Received, Recovery, Interception, Ball Out of Play, Save, Goal',
  },
  {
    event: '+1 frame — slightly after moment',
    offset: 1,
    detail: 'Take on, Foul',
    exception:
      'Immediate follow-up after Pass Received / Recovery / Interception uses 0 for the second event.',
  },
];

module.exports = {
  FPS,
  FRAME_OFFSETS,
  FRAME_OFFSET_DEFAULT,
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
