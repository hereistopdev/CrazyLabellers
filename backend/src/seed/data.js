const terminologies = [
  {
    eventType: 'Pass',
    title: 'Pass',
    order: 1,
    definition:
      'A deliberate attempt by a player to move the ball to a teammate using any legal body part except the arms/hands (unless goalkeeper within their box).',
    criteria: [
      'Player intentionally directs the ball toward a teammate',
      'Ball leaves the passer\'s control with clear target intent',
      'Mark 3 frames before the ball leaves the passer\'s foot/head/body',
    ],
    examples: [
      'Short ground pass between midfielders',
      'Long diagonal pass to the winger',
      'Header pass to a nearby teammate',
    ],
    commonMistakes: [
      'Labeling a deflection as a pass',
      'Marking pass received instead of pass',
      'Using −3 on Pass when player one-touch passes immediately after receiving — use 0 at touch instead',
    ],
  },
  {
    eventType: 'Pass Received',
    title: 'Pass Received',
    order: 2,
    definition:
      'The moment a teammate successfully gains control of the ball from a pass. Mark when the receiving player first controls the ball.',
    criteria: [
      'Ball arrives from a teammate\'s pass',
      'Mark 2 frames before first touch/control by the receiver',
      'Receiver must be the intended target or gains control from the pass',
    ],
    examples: [
      'Midfielder traps a pass with first touch',
      'Striker controls a through ball',
    ],
    commonMistakes: [
      'Marking pass and pass received at the same frame',
      'Marking when pass is played instead of when received',
      'Using −2 on receive then −3 on immediate pass out — use 0 frames for the one-touch pass',
    ],
  },
  {
    eventType: 'Recovery',
    title: 'Recovery',
    order: 3,
    definition:
      'A player regains possession of a loose ball that is not directly won from an opponent\'s controlled possession. Typically after a deflection, rebound, or unclaimed ball.',
    criteria: [
      'No active duel with an opponent at moment of possession',
      'Ball was loose or uncontested',
      'Player gains clear control',
    ],
    examples: [
      'Player picks up a loose ball after a deflected shot',
      'Midfielder collects a ball that bounced off the post',
    ],
    commonMistakes: [
      'Confusing recovery with interception',
      'Labeling a tackle won as recovery',
    ],
  },
  {
    eventType: 'Interception',
    title: 'Interception',
    order: 4,
    definition:
      'A player deliberately cuts out an opponent\'s pass or intended pass, gaining possession or definitively preventing it from reaching the target.',
    criteria: [
      'Opponent was attempting to pass or play the ball',
      'Defender reads and intercepts the passing lane',
      'Mark when the interceptor first touches/blocks the pass',
    ],
    examples: [
      'Defender steps in to intercept a through ball',
      'Midfielder intercepts a sideways pass',
    ],
    commonMistakes: [
      'Labeling any tackle as interception',
      'Marking recovery when the ball was clearly a pass attempt',
    ],
  },
  {
    eventType: 'Ball Out of Play',
    title: 'Ball Out of Play',
    order: 5,
    definition:
      'The exact moment the entire ball crosses completely over the touchline or goal line, leaving the field of play.',
    criteria: [
      'Whole ball must cross the line entirely',
      'Mark 1 frame after the ball exits the pitch',
      'Includes going out for throw-in, corner, or goal kick',
    ],
    examples: [
      'Ball crosses touchline for a throw-in',
      'Ball goes over the goal line off an attacker for a goal kick',
    ],
    commonMistakes: [
      'Marking when the player kicks it rather than when it crosses the line',
      'Marking restart instead of ball out',
    ],
  },
  {
    eventType: 'Clearance',
    title: 'Clearance',
    order: 6,
    definition:
      'A defensive action where a player kicks or heads the ball away from their own goal area to relieve pressure, without a specific target teammate in mind.',
    criteria: [
      'Primary intent is to remove danger, not to pass to a teammate',
      'Usually under pressure in defensive third',
      'Mark when contact is made',
    ],
    examples: [
      'Defender hoofing the ball upfield under pressure',
      'Goalkeeper punching the ball clear',
    ],
    commonMistakes: [
      'Labeling a long pass as clearance',
      'Labeling a block as clearance',
    ],
  },
  {
    eventType: 'Take on',
    title: 'Take on',
    order: 7,
    definition:
      'An attempt by a ball carrier to beat an opponent in a 1v1 situation using dribbling skills, speed, or feints.',
    criteria: [
      'Attacker has the ball and approaches a defender',
      'Clear attempt to dribble past the opponent',
      'Mark at initiation of the take-on attempt',
    ],
    examples: [
      'Winger dribbles at the fullback',
      'Striker takes on the last defender',
    ],
    commonMistakes: [
      'Marking every dribble as take on (only when facing a defender)',
      'Marking the successful outcome instead of the attempt start',
    ],
  },
  {
    eventType: 'Substitution',
    title: 'Substitution',
    order: 8,
    definition:
      'A player exchange made according to the rules, when one player leaves the field and a substitute enters.',
    criteria: [
      'Mark when the substitution is officially completed',
      'Both players must be at the sideline/board',
      'Only label actual substitutions, not tactical talks',
    ],
    examples: [
      'Player walks off and substitute enters at the touchline',
    ],
    commonMistakes: [
      'Marking when sub is announced rather than when completed',
      'Confusing injury treatment stoppage with substitution',
    ],
  },
  {
    eventType: 'Block',
    title: 'Block',
    order: 9,
    definition:
      'A defensive player stops a shot or pass by directly placing their body in the path of the ball, without necessarily gaining possession.',
    criteria: [
      'Defender intentionally blocks ball with body',
      'Ball was traveling toward goal or a teammate',
      'Mark at contact frame',
    ],
    examples: [
      'Defender blocks a shot with their leg',
      'Player blocks a cross with their chest',
    ],
    commonMistakes: [
      'Labeling interception as block',
      'Labeling clearance as block',
    ],
  },
  {
    eventType: 'Aerial Duel',
    title: 'Aerial Duel',
    order: 10,
    definition:
      'Two or more players contesting a ball in the air. Mark at the frame of first contact or highest jump contest.',
    criteria: [
      'Ball is in the air',
      'At least two players challenge for it',
      'Mark first contact or peak contest moment',
    ],
    examples: [
      'Two center-backs jump for a corner kick',
      'Striker and defender contest a long ball',
    ],
    commonMistakes: [
      'Marking the header pass without noting the duel context',
      'Missing the duel when only one player heads it unchallenged',
    ],
  },
  {
    eventType: 'Shot',
    title: 'Shot',
    order: 11,
    definition:
      'An attempt to score by striking the ball toward the goal with the clear intention of scoring.',
    criteria: [
      'Ball is directed toward the goal',
      'Intent to score is evident',
      'Mark 3 frames before shooting contact',
    ],
    examples: [
      'Striker shoots from inside the box',
      'Long-range effort toward goal',
    ],
    commonMistakes: [
      'Labeling a cross as a shot',
      'Labeling a deflected pass toward goal without shooting intent',
    ],
  },
  {
    eventType: 'Save',
    title: 'Save',
    order: 12,
    definition:
      'A goalkeeper (or occasionally an outfield player on the goal line) prevents a shot from entering the goal.',
    criteria: [
      'Must follow a shot on target or goal-bound effort',
      'Mark when the save is made (hands/body contact)',
      'Ball does not cross the goal line',
    ],
    examples: [
      'Goalkeeper dives to parry a shot',
      'Goalkeeper catches a shot cleanly',
    ],
    commonMistakes: [
      'Labeling a block by an outfield player as save (use block unless it\'s on the line)',
      'Marking shot and save at same frame',
    ],
  },
  {
    eventType: 'Foul',
    title: 'Foul',
    order: 13,
    definition:
      'An infringement of the Laws of the Game committed by a player, resulting in a free kick, penalty, or other restart.',
    criteria: [
      'Referee awards a foul or foul is clearly committed',
      'Mark at the frame of contact/infringement',
      'Includes handball, trip, push, etc.',
    ],
    examples: [
      'Sliding tackle from behind trips attacker',
      'Defender handles the ball in the box',
    ],
    commonMistakes: [
      'Marking when whistle blows instead of contact frame',
      'Labeling simulation/diving as foul by the diver (foul is by the offender)',
    ],
  },
  {
    eventType: 'Goal',
    title: 'Goal',
    order: 14,
    definition:
      'The entire ball crosses the goal line between the posts and under the crossbar, awarded as a goal by the referee.',
    criteria: [
      'Whole ball crosses goal line',
      'Mark 1 frame after the whole ball crosses the line',
      'Must be a awarded goal, not disallowed',
    ],
    examples: [
      'Shot nestles in the bottom corner',
      'Header from a corner crosses the line',
    ],
    commonMistakes: [
      'Marking shot instead of goal',
      'Marking celebration instead of ball crossing line',
    ],
  },
  {
    eventType: 'Highlight Start',
    title: 'Highlight Start',
    order: 15,
    definition:
      'The beginning of a notable sequence worth highlighting in AI narration — typically when build-up to an important moment starts.',
    criteria: [
      'Marks start of a narratively important sequence',
      'Usually precedes a goal, great save, or key chance',
      'Use sparingly — not every pass starts a highlight',
    ],
    examples: [
      'Counter-attack begins after interception',
      'Team wins ball and builds toward a goal',
    ],
    commonMistakes: [
      'Marking highlight start at every attacking move',
      'Starting highlight at the shot instead of build-up',
    ],
  },
  {
    eventType: 'Highlight End',
    title: 'Highlight End',
    order: 16,
    definition:
      'The end of a notable highlight sequence — when the action concludes and play returns to normal tempo.',
    criteria: [
      'Pairs with a Highlight Start',
      'Mark when the sequence clearly ends',
      'Usually after goal celebration, save, or missed chance resolution',
    ],
    examples: [
      'Celebration ends and teams reset for kickoff',
      'Goalkeeper collects ball after a scramble',
    ],
    commonMistakes: [
      'Ending highlight too early before sequence resolves',
      'Not pairing highlight end with a start',
    ],
  },
];

const testQuestions = [
  {
    scenario:
      'A midfielder plays a ground ball to a striker. The striker controls it with their first touch at the edge of the box.',
    options: ['Pass', 'Pass Received', 'Recovery', 'Take on'],
    correctAnswer: 'Pass Received',
    explanation:
      'Mark Pass Received at the frame the striker first controls the ball. The Pass event is marked when the midfielder plays it.',
    difficulty: 'easy',
  },
  {
    scenario:
      'A defender sees a through ball and steps into the lane, cutting it out before it reaches the attacker.',
    options: ['Interception', 'Recovery', 'Block', 'Clearance'],
    correctAnswer: 'Interception',
    explanation:
      'This is a deliberate cut-out of an opponent\'s pass — an interception, not a recovery of a loose ball.',
    difficulty: 'easy',
  },
  {
    scenario:
      'After a shot hits the post, the ball bounces free in the six-yard box with no players nearby. A defender runs in and controls it.',
    options: ['Recovery', 'Save', 'Clearance', 'Interception'],
    correctAnswer: 'Recovery',
    explanation:
      'The ball was loose with no active duel — the defender is recovering possession, not making a save or clearance yet.',
    difficulty: 'medium',
  },
  {
    scenario:
      'A winger under no pressure in the defensive third kicks the ball high and long with no target, just to get rid of it.',
    options: ['Clearance', 'Pass', 'Recovery', 'Block'],
    correctAnswer: 'Clearance',
    explanation:
      'The intent is to relieve pressure, not pass to a teammate — this is a clearance.',
    difficulty: 'easy',
  },
  {
    scenario:
      'An attacker dribbles directly at a defender, performing a step-over to try to get past them.',
    options: ['Take on', 'Pass', 'Foul', 'Recovery'],
    correctAnswer: 'Take on',
    explanation:
      'A 1v1 attempt to beat a defender with the ball is a take on. Mark at the start of the attempt.',
    difficulty: 'easy',
  },
  {
    scenario:
      'Two center backs jump for a long throw-in, both challenging for the ball in the air.',
    options: ['Aerial Duel', 'Pass', 'Foul', 'Clearance'],
    correctAnswer: 'Aerial Duel',
    explanation:
      'Two players contesting a ball in the air is an aerial duel.',
    difficulty: 'easy',
  },
  {
    scenario:
      'A striker shoots from 20 yards. The goalkeeper dives and pushes the ball around the post.',
    options: ['Save', 'Block', 'Goal', 'Recovery'],
    correctAnswer: 'Save',
    explanation:
      'The goalkeeper prevents a shot from entering the goal — this is a save.',
    difficulty: 'easy',
  },
  {
    scenario:
      'A defender slides and trips the attacker. The referee awards a free kick.',
    options: ['Foul', 'Recovery', 'Block', 'Interception'],
    correctAnswer: 'Foul',
    explanation:
      'Mark the foul at the frame of contact/infringement, not when the whistle blows.',
    difficulty: 'easy',
  },
  {
    scenario:
      'A shot beats the keeper and the entire ball crosses the line between the posts.',
    options: ['Goal', 'Shot', 'Highlight End', 'Save'],
    correctAnswer: 'Goal',
    explanation:
      'Mark Goal at the exact frame the whole ball crosses the goal line.',
    difficulty: 'easy',
  },
  {
    scenario:
      'A cross comes in and a defender sticks out their leg, stopping the ball from reaching the striker but not controlling it.',
    options: ['Block', 'Interception', 'Clearance', 'Recovery'],
    correctAnswer: 'Block',
    explanation:
      'Stopping a pass/shot with the body without gaining possession is a block.',
    difficulty: 'medium',
  },
  {
    scenario:
      'The ball rolls slowly across the touchline and completely leaves the field.',
    options: ['Ball Out of Play', 'Foul', 'Clearance', 'Recovery'],
    correctAnswer: 'Ball Out of Play',
    explanation:
      'Mark when the entire ball has crossed the line and is out of play.',
    difficulty: 'easy',
  },
  {
    scenario:
      'A substitute enters the field as another player jogs to the sideline and leaves. The exchange is complete.',
    options: ['Substitution', 'Foul', 'Ball Out of Play', 'Recovery'],
    correctAnswer: 'Substitution',
    explanation:
      'Mark substitution when the exchange is officially completed at the sideline.',
    difficulty: 'easy',
  },
  {
    scenario:
      'After winning the ball, the team launches a fast counter-attack that will lead to a goal. You want to mark where the highlight sequence begins.',
    options: ['Highlight Start', 'Recovery', 'Pass', 'Take on'],
    correctAnswer: 'Highlight Start',
    explanation:
      'Highlight Start marks the beginning of a narratively important sequence, such as a counter-attack leading to a goal.',
    difficulty: 'medium',
  },
  {
    scenario:
      'The goal celebration finishes and both teams walk back to their halves for the restart kickoff.',
    options: ['Highlight End', 'Goal', 'Substitution', 'Ball Out of Play'],
    correctAnswer: 'Highlight End',
    explanation:
      'Highlight End marks when a notable sequence concludes — here, after the celebration before restart.',
    difficulty: 'medium',
  },
  {
    scenario:
      'A midfielder intentionally plays a 15-yard ball to a teammate on the wing.',
    options: ['Pass', 'Pass Received', 'Clearance', 'Take on'],
    correctAnswer: 'Pass',
    explanation:
      'Mark Pass at the frame the ball leaves the passer\'s control toward a teammate.',
    difficulty: 'easy',
  },
  {
    scenario:
      'A player heads the ball to a teammate from a corner kick, unchallenged.',
    options: ['Pass', 'Aerial Duel', 'Clearance', 'Recovery'],
    correctAnswer: 'Pass',
    explanation:
      'An intentional header to a teammate is a pass. Aerial Duel requires contest between players.',
    difficulty: 'hard',
  },
  {
    scenario:
      'An attacker shoots but a defender on the goal line blocks it before it crosses. The goalkeeper was beaten.',
    options: ['Block', 'Save', 'Clearance', 'Interception'],
    correctAnswer: 'Block',
    explanation:
      'An outfield player stopping a goal-bound effort is a block. Save is primarily for the goalkeeper.',
    difficulty: 'hard',
  },
  {
    scenario:
      'A long ball is miscontrolled and sits between two players. Neither has possession. A third player runs onto it freely.',
    options: ['Recovery', 'Interception', 'Pass Received', 'Take on'],
    correctAnswer: 'Recovery',
    explanation:
      'A loose, uncontested ball picked up by a player is recovery, not interception.',
    difficulty: 'medium',
  },
  {
    scenario:
      'A player receives a pass, turns, and immediately shoots at goal.',
    options: ['Shot', 'Pass Received', 'Take on', 'Goal'],
    correctAnswer: 'Shot',
    explanation:
      'The question asks about the shot attempt — mark Shot at contact. Pass Received was at the earlier control.',
    difficulty: 'medium',
  },
  {
    scenario:
      'A defender passes back to the goalkeeper, who controls it with their feet inside the box.',
    options: ['Pass Received', 'Pass', 'Recovery', 'Save'],
    correctAnswer: 'Pass Received',
    explanation:
      'Mark Pass Received when the goalkeeper first controls the back pass.',
    difficulty: 'medium',
  },
];

const sampleAssignments = [
  {
    title: 'Sample Clip 1 - Counter Attack',
    description: 'Practice labeling a counter-attack sequence (30 seconds)',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    durationSeconds: 30,
    status: 'available',
  },
  {
    title: 'Sample Clip 2 - Set Piece',
    description: 'Practice labeling corner kick and aerial events',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    durationSeconds: 30,
    status: 'available',
  },
  {
    title: 'Sample Clip 3 - Build-up Play',
    description: 'Practice passes, take-ons, and shots',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    durationSeconds: 30,
    status: 'available',
  },
];

module.exports = { terminologies, testQuestions, sampleAssignments };
