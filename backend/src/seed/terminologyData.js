/** Official event definitions — must match client terminology spec. */
const OFFICIAL_DEFINITIONS = {
  Pass: 'A pass is when a player kicks or throws the ball to one of their teammates.',
  'Pass Received':
    'A Pass Received refers to the successful completion of a pass when a player gains control of the ball after it has been deliberately passed to them by a teammate.',
  Recovery:
    'A player gains possession after no team has possession of the ball or the ball is directed to them by an opponent. Active attempts to intercept the ball are excluded.',
  Tackle:
    'A player tries to stop an opposing player from progressing further with the ball or takes possession from an opposing player.',
  Interception: 'A player intercepts an opposing team pass between two opposing players.',
  'Ball Out of Play': 'The ball goes out of play.',
  Clearance:
    'A player clears the ball to safety by kick or header and eliminates immediate threat toward his/her own goal within the goal section (penalty area / defensive box). Do not mark Clearance outside the goal section — use Pass, Recovery, or Ball Out of Play instead.',
  'Take on':
    'Situations in which a player in control of the ball moves past an opponent player. Awarded to the offensive player who performs the take-on.',
  Substitution:
    'Refers to the event when a player enters the match to replace a teammate. This occurs during a stoppage in play.',
  Block: 'A player blocks a shot by an opposing player.',
  'Aerial Duel':
    'An aerial duel occurs when two or more players attempt to gain possession of the ball in the air, typically using their head, for example after a long goal kick or a cross. At least one player must jump or clearly attempt to jump in order to contest the ball in the air. Do not mark Aerial Duel if no player jumps or clearly attempts to jump, even when the ball is in the air. The key criterion is that the players are competing for the same ball, with physical contact or a visible attempt to win the ball. A separate event is recorded for each player involved in the duel.',
  Shot:
    'A Shot is an attempt made by a player to score a goal by striking or directing the ball towards the opponent\'s goal.',
  Save: 'When the goalkeeper stops the ball from entering the net after a shot.',
  Foul:
    'Occurs when a player breaks the laws of the game through unfair play or actions such as tripping, pushing, or handling the ball, resulting in a free kick or penalty for the opposing team. Excluding offside events and advantages. Referee needs to stop play.',
  Goal:
    'To be awarded, the ball must pass completely over the goal line in the area between the posts and beneath the crossbar. Always comes with a shot event at the same time.',
  'Highlight Start':
    'Mark when the clip enters footage that is not part of the main match board — e.g. replays, crowd shots, tunnel walk, or other non-live-action segments that should be excluded from main gameplay labeling.',
  'Highlight End':
    'Mark when non-main-board footage ends and live match action resumes on the main game board.',
  Referee:
    'Mark when the referee blows the whistle to confirm a stoppage in play. Pair with Foul (infringement confirmed), Ball Out of Play (restart after the ball left the field), or Goal (goal confirmed). Use at 0 frames on the whistle — not for advantage or offside.',
  Invalid:
    'Mark when a player receives or throws/kicks the ball to or from someone who is not an on-pitch player — e.g. ball to/from coaching staff, ball boy, or other non-player personnel at the touchline. Pair with Ball Out of Play when the ball leaves the field as part of that exchange.',
};

const terminologies = [
  {
    eventType: 'Pass',
    title: 'Pass',
    order: 1,
    definition: OFFICIAL_DEFINITIONS.Pass,
    criteria: ['Player kicks or throws the ball deliberately to a teammate'],
    commonMistakes: ['Marking Pass Received instead of Pass', 'Labeling a clearance as a pass'],
  },
  {
    eventType: 'Pass Received',
    title: 'Pass Received',
    order: 2,
    definition: OFFICIAL_DEFINITIONS['Pass Received'],
    criteria: ['Teammate deliberately passed the ball', 'Receiver gains control', 'When more than two players are together, only mark if it is clear which player possessed the ball'],
    commonMistakes: ['Marking at the same frame as Pass', 'Marking when the pass is played, not received', 'Marking when possession is unclear in a crowded contest'],
  },
  {
    eventType: 'Recovery',
    title: 'Recovery',
    order: 3,
    definition: OFFICIAL_DEFINITIONS.Recovery,
    criteria: ['No team had possession, or ball came from an opponent without a tackle contest', 'When more than two players are together, only mark if it is clear which player possessed the ball'],
    commonMistakes: ['Labeling an interception as recovery', 'Labeling a tackle as recovery', 'Marking when possession is unclear in a crowded contest'],
  },
  {
    eventType: 'Tackle',
    title: 'Tackle',
    order: 4,
    definition: OFFICIAL_DEFINITIONS.Tackle,
    criteria: ['Opponent had the ball', 'Player stops progress or wins possession from that opponent'],
    commonMistakes: ['Labeling interception as tackle', 'Labeling a foul as a successful tackle'],
  },
  {
    eventType: 'Interception',
    title: 'Interception',
    order: 5,
    definition: OFFICIAL_DEFINITIONS.Interception,
    criteria: ['Opposing pass between two opposing players is cut out'],
    commonMistakes: ['Labeling recovery of a loose ball as interception', 'Labeling tackle as interception'],
  },
  {
    eventType: 'Ball Out of Play',
    title: 'Ball Out of Play',
    order: 6,
    definition: OFFICIAL_DEFINITIONS['Ball Out of Play'],
    criteria: ['Ball has left the field of play', 'Pair with Referee when the whistle confirms the restart'],
    commonMistakes: ['Marking when the player kicks it instead of when it goes out', 'Forgetting Referee when the whistle is shown'],
  },
  {
    eventType: 'Clearance',
    title: 'Clearance',
    order: 7,
    definition: OFFICIAL_DEFINITIONS.Clearance,
    criteria: ['Immediate threat to own goal is removed', 'Action occurs within the goal section (penalty area)', 'Who gains possession afterwards does not matter'],
    commonMistakes: ['Labeling a targeted pass as clearance', 'Labeling a block as clearance', 'Marking clearance outside the goal section'],
  },
  {
    eventType: 'Take on',
    title: 'Take on',
    order: 8,
    definition: OFFICIAL_DEFINITIONS['Take on'],
    criteria: ['Attacker in control moves past an opponent', 'Award to the offensive player performing the take-on'],
    commonMistakes: ['Marking every dribble as take on', 'Awarding to the defender'],
  },
  {
    eventType: 'Substitution',
    title: 'Substitution',
    order: 9,
    definition: OFFICIAL_DEFINITIONS.Substitution,
    criteria: ['Player enters to replace a teammate', 'Occurs during a stoppage in play'],
    commonMistakes: ['Marking when announced instead of when completed during stoppage'],
  },
  {
    eventType: 'Block',
    title: 'Block',
    order: 10,
    definition: OFFICIAL_DEFINITIONS.Block,
    criteria: ['Opposing player had a shot', 'Block stops the shot'],
    commonMistakes: ['Labeling interception or clearance as block', 'Labeling goalkeeper save as block'],
  },
  {
    eventType: 'Aerial Duel',
    title: 'Aerial Duel',
    order: 11,
    definition: OFFICIAL_DEFINITIONS['Aerial Duel'],
    criteria: [
      'Two or more players compete for the same ball in the air',
      'At least one player jumps or clearly attempts to jump',
      'Do not mark if no one jumps, even when the ball is in the air',
      'Record a separate event for each player involved',
    ],
    commonMistakes: ['Marking an unchallenged header as aerial duel', 'Recording only one player in a contested duel', 'Marking aerial duel when players stay on the ground'],
  },
  {
    eventType: 'Shot',
    title: 'Shot',
    order: 12,
    definition: OFFICIAL_DEFINITIONS.Shot,
    criteria: ['Attempt to score by striking or directing the ball toward the opponent\'s goal'],
    commonMistakes: ['Labeling a cross without shooting intent as shot', 'Forgetting to pair Goal with Shot'],
  },
  {
    eventType: 'Save',
    title: 'Save',
    order: 13,
    definition: OFFICIAL_DEFINITIONS.Save,
    criteria: ['Follows a shot', 'Goalkeeper stops the ball entering the net'],
    commonMistakes: ['Labeling outfield blocks as save', 'Marking without a preceding shot'],
  },
  {
    eventType: 'Foul',
    title: 'Foul',
    order: 14,
    definition: OFFICIAL_DEFINITIONS.Foul,
    criteria: [
      'Unfair play: tripping, pushing, handling, etc.',
      'Pair with Referee when the whistle confirms the foul',
      'Excludes offside and advantage situations',
    ],
    commonMistakes: [
      'Marking Referee instead of Foul at the infringement',
      'Labeling offside as foul',
    ],
  },
  {
    eventType: 'Goal',
    title: 'Goal',
    order: 15,
    definition: OFFICIAL_DEFINITIONS.Goal,
    criteria: [
      'Whole ball crosses goal line between posts and under crossbar',
      'Always label Shot at the same time as Goal',
      'Pair with Referee when the whistle confirms the goal',
    ],
    commonMistakes: ['Marking only Goal without Shot', 'Marking celebration instead of ball crossing line'],
  },
  {
    eventType: 'Highlight Start',
    title: 'Highlight Start',
    order: 16,
    definition: OFFICIAL_DEFINITIONS['Highlight Start'],
    criteria: [
      'Footage is not main live match board action',
      'Replays, crowd, tunnel, or other non-gameplay segments',
    ],
    commonMistakes: [
      'Marking during normal in-play action',
      'Using instead of Ball Out of Play when the ball simply leaves the pitch',
    ],
  },
  {
    eventType: 'Highlight End',
    title: 'Highlight End',
    order: 17,
    definition: OFFICIAL_DEFINITIONS['Highlight End'],
    criteria: ['Non-main-board segment ends', 'Live match action on the main board resumes'],
    commonMistakes: [
      'Marking when play resumes after a normal stoppage',
      'Pairing without a matching Highlight Start',
    ],
  },
  {
    eventType: 'Referee',
    title: 'Referee',
    order: 18,
    definition: OFFICIAL_DEFINITIONS.Referee,
    criteria: [
      'Referee whistle confirms a stoppage',
      'Pair with Foul, Ball Out of Play, or Goal when the whistle confirms that event',
      'Not used for advantage or offside',
    ],
    commonMistakes: [
      'Marking Referee instead of Foul at the contact frame',
      'Omitting Referee after Ball Out of Play or Goal when the whistle is shown',
    ],
  },
  {
    eventType: 'Invalid',
    title: 'Invalid',
    order: 19,
    definition: OFFICIAL_DEFINITIONS.Invalid,
    criteria: [
      'Ball goes to or from a non-player (staff, ball crew, etc.)',
      'Exchange is at the touchline or sideline with non-participants',
      'Pair with Ball Out of Play when the ball leaves the field in that exchange',
    ],
    commonMistakes: [
      'Labeling a normal throw-in to a teammate as Invalid',
      'Marking only Invalid without Ball Out of Play when the ball crosses the line',
    ],
  },
];

module.exports = { OFFICIAL_DEFINITIONS, terminologies };
