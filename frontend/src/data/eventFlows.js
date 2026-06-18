export const eventPairs = [
  {
    id: 'pass-pair',
    title: 'Pass → Pass Received',
    description: 'Always two separate events on different frames. Never mark both at the same moment.',
    events: ['Pass', 'Pass Received'],
    rule: 'Pass Received when teammate gains control. Pass when player kicks or throws to a teammate.',
  },
  {
    id: 'shot-goal',
    title: 'Shot → Goal',
    description: 'Goal always comes with a Shot at the same time.',
    events: ['Shot', 'Goal'],
    rule: 'Label both Shot and Goal when the ball crosses the line between the posts and under the crossbar.',
  },
  {
    id: 'shot-outcome',
    title: 'Shot → Outcome',
    description: 'A shot may be followed by Save or Block as separate events.',
    events: ['Shot', 'Save / Block'],
    rule: 'Save = goalkeeper stops the ball after a shot. Block = outfield player blocks a shot.',
  },
];

export const sequenceFlows = [
  {
    id: 'build-up-attack',
    title: 'Build-up Attack',
    subtitle: 'Typical possession sequence leading to a chance',
    steps: [
      { event: 'Pass', note: 'Kick or throw to teammate' },
      { event: 'Pass Received', note: 'Teammate gains control' },
      { event: 'Take on', note: 'Optional — move past opponent', optional: true },
      { event: 'Shot', note: 'Attempt toward goal' },
      { event: 'Save / Goal', note: 'One outcome only', branch: true },
    ],
  },
  {
    id: 'counter-attack',
    title: 'Counter Attack',
    subtitle: 'Fast transition after winning the ball',
    steps: [
      { event: 'Tackle / Interception / Recovery', note: 'Win possession', branch: true },
      { event: 'Pass', note: 'Quick release' },
      { event: 'Pass Received', note: 'Runner controls' },
      { event: 'Take on', note: 'Optional beat defender', optional: true },
      { event: 'Shot', note: 'Effort on goal' },
      { event: 'Goal / Save', note: 'Outcome', branch: true },
    ],
  },
  {
    id: 'defensive-action',
    title: 'Defensive Sequence',
    subtitle: 'Stopping an attack under pressure',
    steps: [
      { event: 'Tackle / Interception', note: 'Win ball from opponent', branch: true },
      { event: 'Block', note: 'Stop an opposing shot', optional: true },
      { event: 'Clearance', note: 'Clear danger to safety' },
      { event: 'Ball Out of Play', note: 'If ball leaves pitch', optional: true },
    ],
  },
  {
    id: 'set-piece',
    title: 'Set Piece / Aerial',
    subtitle: 'Dead ball or contested high ball',
    steps: [
      { event: 'Ball Out of Play', note: 'Ball crossed line' },
      { event: 'Aerial Duel', note: 'Each contesting player gets an event' },
      { event: 'Pass / Clearance / Shot', note: 'Outcome of duel', branch: true },
      { event: 'Pass Received', note: 'If teammate gains control', optional: true },
    ],
  },
  {
    id: 'foul-stoppage',
    title: 'Foul & Stoppage',
    subtitle: 'Infringement and restart',
    steps: [
      { event: 'Foul', note: 'Infringement at +1 frame' },
      { event: 'Referee', note: 'Whistle confirms foul — optional if shown', optional: true },
      { event: 'Ball Out of Play', note: 'Often follows', optional: true },
      { event: 'Substitution', note: 'During stoppage in play', optional: true },
    ],
  },
  {
    id: 'non-gameplay',
    title: 'Non-main-board footage',
    subtitle: 'Replays, crowd, or sideline non-player exchanges',
    steps: [
      { event: 'Highlight Start', note: 'Clip leaves main live match board' },
      { event: 'Highlight End', note: 'Main board action resumes' },
      { event: 'Invalid', note: 'Ball to/from non-players at touchline', optional: true },
    ],
  },
];

export const decisionTrees = [
  {
    id: 'win-ball',
    title: 'Winning the ball — Recovery, Tackle, or Interception?',
    question: 'How did the player get possession?',
    branches: [
      {
        condition: 'No team had possession / loose ball',
        answer: 'Recovery',
        example: 'Rebound off post, ball directed by opponent without a tackle contest',
      },
      {
        condition: 'Opponent had the ball — player stops them or takes it',
        answer: 'Tackle',
        example: 'Challenge on a dribbling attacker and win possession',
      },
      {
        condition: 'Opposing pass between two opposing players is cut out',
        answer: 'Interception',
        example: 'Stepping into a through ball passing lane',
      },
    ],
  },
  {
    id: 'defensive-contact',
    title: 'Block, Save, or Clearance?',
    question: 'What happened defensively?',
    branches: [
      {
        condition: 'Goalkeeper stops the ball after a shot',
        answer: 'Save',
        example: 'Dive, parry, or catch following a shot',
      },
      {
        condition: 'Outfield player blocks an opposing shot',
        answer: 'Block',
        example: 'Leg or body stops a shot — block is for shots only',
      },
      {
        condition: 'Clears immediate threat toward own goal',
        answer: 'Clearance',
        example: 'Kick or header to safety under pressure',
      },
    ],
  },
  {
    id: 'pass-or-clear',
    title: 'Pass or Clearance?',
    question: 'Was the player passing to a teammate or clearing danger?',
    branches: [
      {
        condition: 'Kicks or throws to a teammate',
        answer: 'Pass',
        example: 'Through ball, cross to striker, short pass',
      },
      {
        condition: 'Eliminates immediate threat to own goal',
        answer: 'Clearance',
        example: 'Defender clears under pressure — who gets it next does not matter',
      },
    ],
  },
  {
    id: 'aerial-duel',
    title: 'Aerial Duel or Pass?',
    question: 'Are players competing for the same ball in the air?',
    branches: [
      {
        condition: 'Two+ players jump or attempt to jump for the ball',
        answer: 'Aerial Duel',
        example: 'Corner or long ball — label each contesting player',
      },
      {
        condition: 'Unchallenged control in the air',
        answer: 'Pass / Pass Received',
        example: 'Free header or chest control with no contest',
      },
    ],
  },
];

export const timingRules = [
  {
    rule: '0 frames — contact / visible action',
    events: [
      'Pass',
      'Tackle',
      'Clearance',
      'Block',
      'Aerial Duel',
      'Shot',
      'Substitution',
      'Highlight Start',
      'Highlight End',
      'Referee',
      'Invalid',
    ],
    detail: 'Mark at the contact or visible action frame.',
    offset: 0,
  },
  {
    rule: '−1 frame — slightly before moment',
    events: ['Pass Received', 'Recovery', 'Interception', 'Ball Out of Play', 'Save', 'Goal'],
    detail: 'Mark one frame before the moment (control gained, ball out, save, goal line).',
    offset: -1,
  },
  {
    rule: '+1 frame — slightly after moment',
    events: ['Take on', 'Foul'],
    detail: 'Mark one frame after the take-on beat or foul contact.',
    offset: 1,
  },
  {
    rule: 'Immediate follow-up (0 frames)',
    events: ['Pass', 'Shot', 'Clearance', 'Take on'],
    detail:
      'After Pass Received, Recovery, or Interception with no pause — second event at contact (0), not the normal offset.',
    offset: 0,
  },
  {
    rule: 'Never same frame',
    events: ['Pass', 'Pass Received'],
    detail: 'Pass and Pass Received are always on different frames.',
  },
];

export const eventCategories = [
  {
    name: 'Possession',
    events: ['Pass', 'Pass Received', 'Recovery', 'Tackle', 'Interception', 'Take on'],
    color: '#22c55e',
  },
  {
    name: 'Defensive',
    events: ['Clearance', 'Block', 'Tackle', 'Interception', 'Save'],
    color: '#3b82f6',
  },
  {
    name: 'Attacking',
    events: ['Shot', 'Goal', 'Take on', 'Pass'],
    color: '#f59e0b',
  },
  {
    name: 'Set Play',
    events: [
      'Aerial Duel',
      'Ball Out of Play',
      'Substitution',
      'Foul',
      'Referee',
      'Highlight Start',
      'Highlight End',
      'Invalid',
    ],
    color: '#a78bfa',
  },
];
