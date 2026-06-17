const { terminologies } = require('./terminologyData');

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
      'This is an interception of an opposing pass between players — not recovery of a loose ball.',
    difficulty: 'easy',
  },
  {
    scenario:
      'A defender challenges an attacker who is dribbling and wins the ball cleanly without a foul.',
    options: ['Tackle', 'Interception', 'Recovery', 'Block'],
    correctAnswer: 'Tackle',
    explanation:
      'The defender stops the opponent or takes possession from them — a tackle, not an interception of a pass.',
    difficulty: 'medium',
  },
  {
    scenario:
      'After a shot hits the post, the ball bounces free in the six-yard box with no players nearby. A defender runs in and controls it.',
    options: ['Recovery', 'Save', 'Clearance', 'Interception'],
    correctAnswer: 'Recovery',
    explanation:
      'The ball was loose with no team in possession — recovery. Active intercept attempts are excluded.',
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
      'Two center backs jump for a long goal kick, both clearly attempting to win the ball in the air.',
    options: ['Aerial Duel', 'Pass', 'Foul', 'Clearance'],
    correctAnswer: 'Aerial Duel',
    explanation:
      'Players competing for the same ball in the air — record aerial duel for each player involved.',
    difficulty: 'easy',
  },
  {
    scenario:
      'An opposing midfielder plays a pass between two teammates. A defender cuts it out in the passing lane.',
    options: ['Interception', 'Tackle', 'Recovery', 'Block'],
    correctAnswer: 'Interception',
    explanation:
      'Interception is cutting out an opposing pass between two opposing players.',
    difficulty: 'medium',
  },
  {
    scenario:
      'A striker shoots from 20 yards. The goalkeeper dives and pushes the ball around the post.',
    options: ['Save', 'Block', 'Goal', 'Recovery'],
    correctAnswer: 'Save',
    explanation:
      'The goalkeeper stops the ball from entering the net after a shot — a save.',
    difficulty: 'easy',
  },
  {
    scenario:
      'A defender slides and trips the attacker. The referee awards a free kick.',
    options: ['Foul', 'Recovery', 'Block', 'Interception'],
    correctAnswer: 'Foul',
    explanation:
      'Mark the foul at contact. Offside and advantage situations are excluded.',
    difficulty: 'easy',
  },
  {
    scenario:
      'A shot beats the keeper and the entire ball crosses the line between the posts.',
    options: ['Goal', 'Shot', 'Save', 'Recovery'],
    correctAnswer: 'Goal',
    explanation:
      'Goal is awarded when the whole ball crosses the line. Always label Shot at the same time.',
    difficulty: 'easy',
  },
  {
    scenario:
      'An attacker shoots and a defender sticks out their leg to stop the ball reaching goal.',
    options: ['Block', 'Interception', 'Clearance', 'Tackle'],
    correctAnswer: 'Block',
    explanation:
      'A player blocks a shot by an opposing player. Block applies to shots only.',
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
      'Under pressure in the box, a defender kicks the ball away to remove immediate danger with no target teammate.',
    options: ['Clearance', 'Pass', 'Block', 'Recovery'],
    correctAnswer: 'Clearance',
    explanation:
      'Clearance eliminates immediate threat toward own goal, regardless of who gains possession next.',
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
