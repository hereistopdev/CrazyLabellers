export const eventPairs = [
  {
    id: 'pass-pair',
    title: 'Pass → Pass Received',
    description: 'Always two separate events on different frames. Never mark both at the same moment.',
    events: ['Pass', 'Pass Received'],
    rule: 'Pass Received at −2 frames on control. Pass normally at −3 frames — unless one-touch: then Pass at contact frame (0).',
  },
  {
    id: 'highlight-pair',
    title: 'Highlight Start → Highlight End',
    description: 'Wrap narratively important sequences. Every Highlight Start should eventually have a Highlight End.',
    events: ['Highlight Start', 'Highlight End'],
    rule: 'Start at build-up beginning. End when the sequence resolves (goal, save, miss, restart).',
  },
  {
    id: 'shot-outcome',
    title: 'Shot → Outcome',
    description: 'A shot is always marked first. The outcome is a separate later event.',
    events: ['Shot', 'Save / Goal / Block'],
    rule: 'Shot = contact frame. Save/Goal/Block = the frame that outcome happens — never the same as Shot.',
  },
];

export const sequenceFlows = [
  {
    id: 'build-up-attack',
    title: 'Build-up Attack',
    subtitle: 'Typical possession sequence leading to a chance',
    steps: [
      { event: 'Pass', note: 'Player plays ball forward' },
      { event: 'Pass Received', note: 'Teammate controls' },
      { event: 'Take on', note: 'Optional — 1v1 attempt', optional: true },
      { event: 'Shot', note: 'Attempt on goal' },
      { event: 'Save / Goal', note: 'One outcome only', branch: true },
    ],
  },
  {
    id: 'counter-attack',
    title: 'Counter Attack (Highlight)',
    subtitle: 'Fast transition — wrap with highlight markers',
    steps: [
      { event: 'Highlight Start', note: 'Counter begins', highlight: true },
      { event: 'Interception / Recovery', note: 'Win the ball', branch: true },
      { event: 'Pass', note: 'Quick release' },
      { event: 'Pass Received', note: 'Runner controls' },
      { event: 'Take on', note: 'Optional beat defender', optional: true },
      { event: 'Shot', note: 'Effort on goal' },
      { event: 'Goal / Save', note: 'Outcome', branch: true },
      { event: 'Highlight End', note: 'Sequence over', highlight: true },
    ],
  },
  {
    id: 'defensive-action',
    title: 'Defensive Sequence',
    subtitle: 'Stopping an attack under pressure',
    steps: [
      { event: 'Block / Interception', note: 'Stop pass or shot', branch: true },
      { event: 'Clearance', note: 'Clear danger — no target' },
      { event: 'Ball Out of Play', note: 'If ball leaves pitch', optional: true },
    ],
  },
  {
    id: 'set-piece',
    title: 'Set Piece / Aerial',
    subtitle: 'Dead ball or contested high ball',
    steps: [
      { event: 'Ball Out of Play', note: 'Ball crossed line' },
      { event: 'Aerial Duel', note: 'Players contest in air' },
      { event: 'Pass / Clearance / Shot', note: 'Outcome of duel', branch: true },
      { event: 'Pass Received', note: 'If headed to teammate', optional: true },
    ],
  },
  {
    id: 'foul-stoppage',
    title: 'Foul & Stoppage',
    subtitle: 'Infringement and restart',
    steps: [
      { event: 'Foul', note: 'Contact / infringement frame' },
      { event: 'Ball Out of Play', note: 'Often follows', optional: true },
      { event: 'Substitution', note: 'May occur during stoppage', optional: true },
    ],
  },
];

export const decisionTrees = [
  {
    id: 'win-ball',
    title: 'Winning the ball — Recovery or Interception?',
    question: 'How did the player get possession?',
    branches: [
      {
        condition: 'Ball was loose / uncontested',
        answer: 'Recovery',
        example: 'Rebound off post, miscontrolled ball sitting free',
      },
      {
        condition: 'Opponent was passing to a teammate',
        answer: 'Interception',
        example: 'Cutting out a through ball or sideways pass',
      },
    ],
  },
  {
    id: 'defensive-contact',
    title: 'Defensive contact — Block, Save, or Clearance?',
    question: 'What was the intent and who made contact?',
    branches: [
      {
        condition: 'Goalkeeper stops a shot on goal',
        answer: 'Save',
        example: 'Dive, parry, or catch after a Shot',
      },
      {
        condition: 'Outfield player blocks shot/pass in path',
        answer: 'Block',
        example: 'Leg/chest stops ball, may not gain possession',
      },
      {
        condition: 'Under pressure, clears danger with no target',
        answer: 'Clearance',
        example: 'Hoofed away from own box',
      },
    ],
  },
  {
    id: 'pass-or-clear',
    title: 'Pass or Clearance?',
    question: 'Was there a target teammate?',
    branches: [
      {
        condition: 'Directed at a specific teammate',
        answer: 'Pass',
        example: 'Through ball, cross to striker, short pass',
      },
      {
        condition: 'No target — just removing danger',
        answer: 'Clearance',
        example: 'Defender kicks it long anywhere upfield',
      },
    ],
  },
  {
    id: 'aerial-duel',
    title: 'Aerial Duel or just a Pass?',
    question: 'Is another player contesting the ball in the air?',
    branches: [
      {
        condition: 'Two+ players challenging for the ball',
        answer: 'Aerial Duel',
        example: 'Corner kick, two CBs jumping together',
      },
      {
        condition: 'Unchallenged header to teammate',
        answer: 'Pass',
        example: 'Free header with no opponent nearby',
      },
    ],
  },
];

export const timingRules = [
  {
    rule: 'Default offset: −2 frames',
    events: ['Most events'],
    detail: 'For all events not listed below, mark 2 frames before the action.',
    offset: -2,
  },
  {
    rule: 'Pass: −3 frames',
    events: ['Pass'],
    detail: 'Mark 3 frames before the ball leaves the passer.',
    offset: -3,
  },
  {
    rule: 'Shot: −3 frames',
    events: ['Shot'],
    detail: 'Mark 3 frames before shooting contact.',
    offset: -3,
  },
  {
    rule: 'Ball Out of Play: +1 frame',
    events: ['Ball Out of Play'],
    detail: 'Mark 1 frame after the whole ball crosses the line.',
    offset: 1,
  },
  {
    rule: 'Goal: +1 frame',
    events: ['Goal'],
    detail: 'Mark 1 frame after the whole ball crosses the goal line.',
    offset: 1,
  },
  {
    rule: 'Never same frame',
    events: ['Pass', 'Pass Received'],
    detail: 'Pass and Pass Received are always on different frames.',
  },
  {
    rule: 'Highlight pair',
    events: ['Highlight Start', 'Highlight End'],
    detail: 'Wrap important sequences. Start at build-up, end when resolved.',
  },
];

export const eventCategories = [
  {
    name: 'Possession',
    events: ['Pass', 'Pass Received', 'Recovery', 'Interception', 'Take on'],
    color: '#22c55e',
  },
  {
    name: 'Defensive',
    events: ['Clearance', 'Block', 'Interception', 'Save'],
    color: '#3b82f6',
  },
  {
    name: 'Attacking',
    events: ['Shot', 'Goal', 'Take on', 'Pass'],
    color: '#f59e0b',
  },
  {
    name: 'Set Play',
    events: ['Aerial Duel', 'Ball Out of Play', 'Substitution', 'Foul'],
    color: '#a78bfa',
  },
  {
    name: 'Narrative',
    events: ['Highlight Start', 'Highlight End'],
    color: '#ec4899',
  },
];
