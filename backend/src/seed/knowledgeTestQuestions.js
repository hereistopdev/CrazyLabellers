/**
 * Knowledge test pool — 50 scenario questions focused on hard event distinctions
 * (Clearance vs Recovery, Interception vs Tackle, Block vs Save, etc.).
 * Labellers receive a random 10 per attempt.
 */
const testQuestions = [
  // ── Clearance vs Recovery ──
  {
    scenario:
      'A defender in the six-yard box hoofs the ball into the stands while under immediate shooting pressure. No teammate was the target.',
    options: ['Clearance', 'Recovery', 'Block', 'Pass'],
    correctAnswer: 'Clearance',
    explanation:
      'Removing immediate danger toward own goal is clearance — even if the ball goes out. Recovery is gaining loose possession, not kicking away under threat.',
    difficulty: 'hard',
  },
  {
    scenario:
      'After a failed corner, the ball sits loose on the edge of the box. A midfielder jogs over and controls it with no opponents nearby.',
    options: ['Recovery', 'Clearance', 'Interception', 'Pass Received'],
    correctAnswer: 'Recovery',
    explanation:
      'Loose ball, no team in possession — first player to control it marks recovery. No immediate goal threat was being cleared.',
    difficulty: 'hard',
  },
  {
    scenario:
      'A centre-back heads a dropping ball over the bar from inside the six-yard box while an attacker closes in behind them.',
    options: ['Clearance', 'Recovery', 'Aerial Duel', 'Block'],
    correctAnswer: 'Clearance',
    explanation:
      'Heading away to eliminate immediate goal danger is clearance. Recovery would be if they controlled the loose ball instead.',
    difficulty: 'hard',
  },
  {
    scenario:
      'An attacker miscontrols a through ball and it rolls free. A defender picks it up cleanly — the attacker never had established possession.',
    options: ['Recovery', 'Clearance', 'Tackle', 'Interception'],
    correctAnswer: 'Recovery',
    explanation:
      'Ball was loose with no team in possession. This is not a tackle (no won contest) or interception (no pass between opponents cut out).',
    difficulty: 'hard',
  },
  {
    scenario:
      'Under a high cross, a fullback volleys the ball out for a throw-in from their own penalty area without looking for a teammate.',
    options: ['Clearance', 'Recovery', 'Ball Out of Play', 'Pass'],
    correctAnswer: 'Clearance',
    explanation:
      'Kicking/heading away immediate danger toward own goal is clearance. Ball Out of Play is marked when it crosses the line, not the clearing action.',
    difficulty: 'hard',
  },
  {
    scenario:
      'Following a goalkeeper parry, the rebound sits in the open. The nearest defender traps it — no attacker within two yards.',
    options: ['Recovery', 'Clearance', 'Save', 'Block'],
    correctAnswer: 'Recovery',
    explanation:
      'After the save the ball was loose. The defender gaining possession is recovery, not another clearance or save.',
    difficulty: 'hard',
  },
  {
    scenario:
      'A defender scuffs a clearance that only travels to the edge of the box, but the immediate shooting threat is gone.',
    options: ['Clearance', 'Recovery', 'Pass', 'Block'],
    correctAnswer: 'Clearance',
    explanation:
      'Clearance is judged by removing immediate threat toward own goal inside the goal section — not where the ball ends up or who gets it next.',
    difficulty: 'hard',
  },

  // ── Clearance vs Pass ──
  {
    scenario:
      'Pressed outside the penalty area in their own half, a fullback hoofs the ball toward the halfway line with no teammate in that direction.',
    options: ['Clearance', 'Pass', 'Recovery', 'Ball Out of Play'],
    correctAnswer: 'Pass',
    explanation:
      'Clearance only applies in the goal section (penalty area). Outside the box, a hoof upfield without a teammate is not clearance — use Pass if deliberate, or mark subsequent possession events.',
    difficulty: 'hard',
  },
  {
    scenario:
      'A centre-back under moderate pressure clips a measured 20-yard ball to the holding midfielder who is open.',
    options: ['Pass', 'Clearance', 'Recovery', 'Take on'],
    correctAnswer: 'Pass',
    explanation:
      'Deliberate ball to an identified teammate is a pass, even under pressure. Clearance requires removing danger inside the goal section with no target.',
    difficulty: 'hard',
  },
  {
    scenario:
      'A goalkeeper throws the ball firmly to an unmarked fullback five yards away.',
    options: ['Pass', 'Clearance', 'Pass Received', 'Recovery'],
    correctAnswer: 'Pass',
    explanation:
      'Deliberate distribution to a teammate is a pass when the ball leaves the thrower.',
    difficulty: 'medium',
  },

  // ── Interception vs Recovery ──
  {
    scenario:
      'A defender steps into the lane and cuts a firm pass meant for the striker running in behind.',
    options: ['Interception', 'Recovery', 'Tackle', 'Clearance'],
    correctAnswer: 'Interception',
    explanation:
      'Cutting out an opposing pass between two opposing players is interception — not recovery of a loose ball.',
    difficulty: 'hard',
  },
  {
    scenario:
      'A square pass is mis-hit and bobbles slowly across the turf. A midfielder runs onto it before any opponent.',
    options: ['Recovery', 'Interception', 'Pass Received', 'Tackle'],
    correctAnswer: 'Recovery',
    explanation:
      'The ball was loose — no active pass was intercepted between two opponents. Mark recovery at control.',
    difficulty: 'hard',
  },
  {
    scenario:
      'An opposing winger plays a low cross. A defender reads it and intercepts before it reaches the far-post runner.',
    options: ['Interception', 'Recovery', 'Clearance', 'Block'],
    correctAnswer: 'Interception',
    explanation:
      'Cutting out a deliberate pass/cross between opposing players is interception. Clearance applies when removing own-goal threat.',
    difficulty: 'hard',
  },
  {
    scenario:
      'After a heavy touch, the ball trickles away from the dribbler untouched. An opponent collects it without a challenge.',
    options: ['Recovery', 'Interception', 'Tackle', 'Pass Received'],
    correctAnswer: 'Recovery',
    explanation:
      'Loose ball from a mistake — not an intercepted pass between two opponents. Active intercept attempts are excluded from recovery rules.',
    difficulty: 'hard',
  },
  {
    scenario:
      'A through ball is played between two centre-backs. A defensive midfielder intercepts in the gap.',
    options: ['Interception', 'Recovery', 'Tackle', 'Clearance'],
    correctAnswer: 'Interception',
    explanation:
      'Classic interception: opposing pass between two opposing players cut out by a defender.',
    difficulty: 'medium',
  },

  // ── Interception vs Tackle ──
  {
    scenario:
      'A defender cleanly dispossesses a dribbling winger with a standing challenge, winning the ball at the attacker\'s feet.',
    options: ['Tackle', 'Interception', 'Recovery', 'Foul'],
    correctAnswer: 'Tackle',
    explanation:
      'Taking the ball from an opponent in possession is a tackle. Interception requires cutting a pass between two opponents.',
    difficulty: 'hard',
  },
  {
    scenario:
      'A midfielder lunges for a pass between two opponents but only deflects it to a teammate — they cut the original pass.',
    options: ['Interception', 'Tackle', 'Recovery', 'Block'],
    correctAnswer: 'Interception',
    explanation:
      'The pass between opponents was cut out — interception. Tackle requires challenging the player in possession.',
    difficulty: 'hard',
  },
  {
    scenario:
      'A fullback slides and wins the ball from the winger\'s feet on the touchline without fouling.',
    options: ['Tackle', 'Interception', 'Recovery', 'Ball Out of Play'],
    correctAnswer: 'Tackle',
    explanation:
      'Direct challenge on the ball carrier who had possession — tackle, not interception.',
    difficulty: 'medium',
  },

  // ── Block vs Save vs Clearance ──
  {
    scenario:
      'A striker shoots from eight yards. A centre-back on the line sticks out a leg and stops it crossing.',
    options: ['Block', 'Save', 'Clearance', 'Interception'],
    correctAnswer: 'Block',
    explanation:
      'Outfield player stopping an opposing shot is a block. Save is for the goalkeeper after a shot.',
    difficulty: 'hard',
  },
  {
    scenario:
      'A long-range shot is heading inside the post. The goalkeeper dives and tips it over the bar.',
    options: ['Save', 'Block', 'Clearance', 'Recovery'],
    correctAnswer: 'Save',
    explanation:
      'Goalkeeper stopping a shot from entering the net — save. Blocks are for outfield players stopping shots.',
    difficulty: 'medium',
  },
  {
    scenario:
      'A defender blocks a shot but the ball loops up and lands in the box as a loose ball. What was the block-frame event?',
    options: ['Block', 'Clearance', 'Save', 'Recovery'],
    correctAnswer: 'Block',
    explanation:
      'The initial stop of the shot is block. Any later loose-ball pickup would be recovery — separate events.',
    difficulty: 'hard',
  },
  {
    scenario:
      'A winger shoots. The goalkeeper saves but parries it back into play. A defender then blazes it over from six yards.',
    options: ['Clearance', 'Block', 'Save', 'Recovery'],
    correctAnswer: 'Clearance',
    explanation:
      'The defender is removing immediate danger after the save — clearance (not another save or block of the original shot).',
    difficulty: 'hard',
  },
  {
    scenario:
      'An attacker shoots. The goalkeeper has already committed; a defender deflects the shot wide before it reaches the keeper.',
    options: ['Block', 'Save', 'Interception', 'Clearance'],
    correctAnswer: 'Block',
    explanation:
      'Outfield deflection of a shot attempt — block. The goalkeeper never made the stopping contact.',
    difficulty: 'hard',
  },

  // ── Pass vs Pass Received vs Recovery ──
  {
    scenario:
      'A midfielder plays a crisp pass. At what frame do you mark the pass event?',
    options: ['Pass', 'Pass Received', 'Recovery', 'Take on'],
    correctAnswer: 'Pass',
    explanation:
      'Pass is marked at 0 frames when the ball leaves the passer\'s control — not when the receiver controls it (Pass Received at −1f).',
    difficulty: 'hard',
  },
  {
    scenario:
      'A striker receives a through ball and controls it with their first touch inside the box.',
    options: ['Pass Received', 'Pass', 'Recovery', 'Shot'],
    correctAnswer: 'Pass Received',
    explanation:
      'Mark Pass Received at first control after a deliberate teammate pass — not at the pass itself. Uses −1 frame offset.',
    difficulty: 'medium',
  },
  {
    scenario:
      'An opponent\'s clearance deflects off a midfielder\'s shin and drops at their feet. They control it.',
    options: ['Recovery', 'Pass Received', 'Interception', 'Clearance'],
    correctAnswer: 'Recovery',
    explanation:
      'Ball came from opponent without a tackle contest on a pass between two opponents — recovery, not pass received.',
    difficulty: 'hard',
  },
  {
    scenario:
      'A one-two: the striker passes to the midfielder and receives the return pass on the edge of the box.',
    options: ['Pass Received', 'Pass', 'Take on', 'Recovery'],
    correctAnswer: 'Pass Received',
    explanation:
      'At the return control, mark Pass Received. The outward pass was a separate Pass event earlier.',
    difficulty: 'hard',
  },

  // ── Pass vs Aerial Duel ──
  {
    scenario:
      'From a corner, a player heads the ball to a teammate at the near post with no opponent challenging the header.',
    options: ['Pass', 'Aerial Duel', 'Clearance', 'Shot'],
    correctAnswer: 'Pass',
    explanation:
      'Intentional header to a teammate without aerial contest is a pass. Aerial duel requires competing for the same ball in the air with at least one jump.',
    difficulty: 'hard',
  },
  {
    scenario:
      'Two centre-backs jump together for a long ball; both clearly attempt to win the header.',
    options: ['Aerial Duel', 'Pass', 'Clearance', 'Recovery'],
    correctAnswer: 'Aerial Duel',
    explanation:
      'Competing for the same ball in the air with at least one jump — record aerial duel for each player involved.',
    difficulty: 'medium',
  },
  {
    scenario:
      'A striker rises alone for a high ball with no opponent within two yards and heads it down to a teammate.',
    options: ['Pass', 'Aerial Duel', 'Recovery', 'Clearance'],
    correctAnswer: 'Pass',
    explanation:
      'No contest in the air and no jump — intentional header to teammate is pass, not aerial duel.',
    difficulty: 'hard',
  },

  // ── Tackle vs Foul vs Recovery ──
  {
    scenario:
      'A defender trips the dribbler. The referee blows for a free kick and no ball was won.',
    options: ['Foul', 'Tackle', 'Recovery', 'Interception'],
    correctAnswer: 'Foul',
    explanation:
      'Illegal challenge with play stopped — foul. Do not mark a successful tackle when the foul is given.',
    difficulty: 'hard',
  },
  {
    scenario:
      'A defender wins the ball with a shoulder challenge deemed legal by the referee. Possession changes cleanly.',
    options: ['Tackle', 'Foul', 'Interception', 'Recovery'],
    correctAnswer: 'Tackle',
    explanation:
      'Legal dispossession of an opponent in possession — tackle.',
    difficulty: 'medium',
  },
  {
    scenario:
      'After a successful tackle the ball squirms loose. The same defender immediately controls it.',
    options: ['Recovery', 'Tackle', 'Interception', 'Clearance'],
    correctAnswer: 'Recovery',
    explanation:
      'The tackle was the challenge; once the ball is loose, the pickup is recovery — not a second tackle.',
    difficulty: 'hard',
  },

  // ── Take on vs Pass Received ──
  {
    scenario:
      'A winger receives the ball and immediately drives at the fullback, attempting to beat them on the outside.',
    options: ['Take on', 'Pass Received', 'Recovery', 'Pass'],
    correctAnswer: 'Take on',
    explanation:
      'The question describes the 1v1 attempt after control — take on at the start of the move past the defender.',
    difficulty: 'hard',
  },
  {
    scenario:
      'A player receives a pass wide and holds it without yet engaging a defender.',
    options: ['Pass Received', 'Take on', 'Pass', 'Recovery'],
    correctAnswer: 'Pass Received',
    explanation:
      'First control after the teammate pass — Pass Received. Take on comes when they attempt to beat an opponent.',
    difficulty: 'hard',
  },

  // ── Shot vs Goal vs Ball Out ──
  {
    scenario:
      'A volley strikes the underside of the bar and crosses fully over the goal line between the posts.',
    options: ['Goal', 'Shot', 'Ball Out of Play', 'Save'],
    correctAnswer: 'Goal',
    explanation:
      'Whole ball crossed the line between posts and under the bar — Goal at −2f (and Shot at 0f on contact). Add Referee at 0f if the whistle is shown.',
    difficulty: 'medium',
  },
  {
    scenario:
      'A player strikes the ball toward goal from 25 yards. The keeper catches it cleanly.',
    options: ['Shot', 'Save', 'Goal', 'Pass'],
    correctAnswer: 'Shot',
    explanation:
      'The question is about the attempt toward goal — shot at contact. Save is the goalkeeper\'s separate action.',
    difficulty: 'medium',
  },
  {
    scenario:
      'A shot hits the post, rolls across the goal mouth without fully crossing, and goes out for a goal kick.',
    options: ['Ball Out of Play', 'Goal', 'Save', 'Block'],
    correctAnswer: 'Ball Out of Play',
    explanation:
      'Ball fully left the field without scoring — Ball Out of Play at −1 frame when it crosses the line.',
    difficulty: 'hard',
  },
  {
    scenario:
      'A low cross flicks off a defender\'s toe and crosses the goal line wide of the post for a corner.',
    options: ['Ball Out of Play', 'Goal', 'Clearance', 'Block'],
    correctAnswer: 'Ball Out of Play',
    explanation:
      'Ball crossed the goal line wide of the posts — Ball Out of Play at −1 frame at full crossing.',
    difficulty: 'hard',
  },

  // ── Save vs Recovery (goalkeeper) ──
  {
    scenario:
      'The goalkeeper rushes out and smothers a loose ball in the box. No shot was taken.',
    options: ['Recovery', 'Save', 'Clearance', 'Pass Received'],
    correctAnswer: 'Recovery',
    explanation:
      'Collecting a loose ball without a shot attempt is recovery — not a save (saves require a preceding shot).',
    difficulty: 'hard',
  },
  {
    scenario:
      'A goalkeeper punches a high cross away from several attackers. No shot has occurred.',
    options: ['Clearance', 'Save', 'Aerial Duel', 'Recovery'],
    correctAnswer: 'Clearance',
    explanation:
      'Removing immediate danger from a cross without a shot — clearance. Save requires stopping a shot on target.',
    difficulty: 'hard',
  },

  // ── Block vs Interception (shot vs pass) ──
  {
    scenario:
      'A midfielder shoots from distance. A defender deflects it with their chest.',
    options: ['Block', 'Interception', 'Clearance', 'Tackle'],
    correctAnswer: 'Block',
    explanation:
      'Block applies to shots only. Interception applies to passes between opposing players.',
    difficulty: 'hard',
  },
  {
    scenario:
      'A cut-back pass is played across the six-yard box. A defender slides and cuts it out before the tap-in.',
    options: ['Interception', 'Block', 'Clearance', 'Tackle'],
    correctAnswer: 'Interception',
    explanation:
      'Cutting out a pass between opposing players — interception. Not a block (no shot) or clearance (pass cut, not hoisted away).',
    difficulty: 'hard',
  },

  // ── Clearance vs Block ──
  {
    scenario:
      'A defender inside the penalty area facing their own goal kicks the ball upfield while an attacker closes down. No shot was taken.',
    options: ['Clearance', 'Block', 'Recovery', 'Pass'],
    correctAnswer: 'Clearance',
    explanation:
      'Removing pressure/threat toward own goal inside the goal section without a shot to block — clearance.',
    difficulty: 'hard',
  },

  // ── Foul edge cases ──
  {
    scenario:
      'A trip is committed in midfield and the referee immediately stops play for a direct free kick.',
    options: ['Foul', 'Tackle', 'Recovery', 'Interception'],
    correctAnswer: 'Foul',
    explanation:
      'Referee stops play for the infringement — mark Foul (+2 frames from contact). Use Referee for the confirming whistle. Advantage situations are excluded.',
    difficulty: 'medium',
  },

  // ── Substitution & misc ──
  {
    scenario:
      'During a stoppage for injury, a substitute completes the exchange with the player leaving at the touchline.',
    options: ['Substitution', 'Ball Out of Play', 'Foul', 'Recovery'],
    correctAnswer: 'Substitution',
    explanation:
      'Mark substitution when the exchange completes during an official stoppage.',
    difficulty: 'medium',
  },
  {
    scenario:
      'A long throw-in is delivered deliberately to a midfielder\'s chest ten yards away.',
    options: ['Pass', 'Clearance', 'Aerial Duel', 'Ball Out of Play'],
    correctAnswer: 'Pass',
    explanation:
      'Deliberate throw to a teammate is a pass when the ball leaves the thrower.',
    difficulty: 'hard',
  },
  {
    scenario:
      'An attacker shoots. The ball deflects off a defender\'s boot, wrong-foots the keeper, and crosses the line between the posts.',
    options: ['Goal', 'Block', 'Shot', 'Recovery'],
    correctAnswer: 'Goal',
    explanation:
      'Whole ball crossed the goal line between the posts — Goal at −2 frames, with Shot at 0f on contact.',
    difficulty: 'hard',
  },
  {
    scenario:
      'Two strikers contest a high ball; one jumps, the other clearly attempts to jump and challenge.',
    options: ['Aerial Duel', 'Pass', 'Foul', 'Clearance'],
    correctAnswer: 'Aerial Duel',
    explanation:
      'Both players competing for the same ball in the air — separate aerial duel for each.',
    difficulty: 'medium',
  },
  {
    scenario:
      'A defender misplaces a short pass straight to an opponent, who controls it without a challenge.',
    options: ['Recovery', 'Interception', 'Pass Received', 'Tackle'],
    correctAnswer: 'Recovery',
    explanation:
      'Ball directed to an opponent without a tackle contest — recovery, not pass received.',
    difficulty: 'hard',
  },

  // ── Frame offsets (mark timing) ──
  {
    scenario:
      'Which event type uses a −1 frame offset (mark one frame before the control/out moment)?',
    options: ['Pass Received', 'Pass', 'Shot', 'Tackle'],
    correctAnswer: 'Pass Received',
    explanation:
      'Pass Received, Recovery, Interception, Ball Out of Play, and Save use −1 frame. Goal uses −2 frames. Pass, Shot, and Tackle use 0 frames at contact.',
    difficulty: 'medium',
  },
  {
    scenario:
      'You pause on the frame where the passer\'s foot clearly strikes the ball toward a teammate. Which event?',
    options: ['Pass', 'Pass Received', 'Recovery', 'Take on'],
    correctAnswer: 'Pass',
    explanation: 'Pass is marked at 0 frames — the contact frame when the ball is played.',
    difficulty: 'medium',
  },
  {
    scenario:
      'A striker beats a defender one frame after taking first touch. Which event marks the beat?',
    options: ['Take on', 'Pass Received', 'Tackle', 'Recovery'],
    correctAnswer: 'Take on',
    explanation: 'Take on uses +2 frames — mark two frames after the visible beat past the opponent.',
    difficulty: 'hard',
  },
  {
    scenario:
      'The whole ball has just crossed the touchline. Which event and offset apply?',
    options: ['Ball Out of Play', 'Goal', 'Invalid', 'Clearance'],
    correctAnswer: 'Ball Out of Play',
    explanation: 'Ball Out of Play is marked at −1 frame from the crossing moment.',
    difficulty: 'medium',
  },

  // ── Referee, Invalid, Highlight ──
  {
    scenario:
      'The referee blows the whistle to stop play and confirm a foul that was committed two frames earlier.',
    options: ['Referee', 'Foul', 'Ball Out of Play', 'Substitution'],
    correctAnswer: 'Referee',
    explanation:
      'Referee marks the confirming whistle at 0 frames. Foul marks the infringement at +2 frames — a separate earlier event. Referee also pairs with Ball Out of Play and Goal.',
    difficulty: 'medium',
  },
  {
    scenario:
      'A ball boy throws a replacement ball to a player at the touchline — not to a teammate on the pitch.',
    options: ['Invalid', 'Ball Out of Play', 'Pass Received', 'Substitution'],
    correctAnswer: 'Invalid',
    explanation:
      'Ball exchanged with a non-player (staff, ball crew) is Invalid at 0 frames. Pair with Ball Out of Play at −1f if the ball crosses the line.',
    difficulty: 'hard',
  },
  {
    scenario:
      'The broadcast cuts from live pitch action to a slow-motion replay of the previous chance.',
    options: ['Highlight Start', 'Highlight End', 'Ball Out of Play', 'Substitution'],
    correctAnswer: 'Highlight Start',
    explanation:
      'Highlight Start marks when footage leaves the main live match board (replays, crowd, etc.).',
    difficulty: 'medium',
  },
  {
    scenario:
      'After a replay, the feed returns to live wide-angle match action on the main board.',
    options: ['Highlight End', 'Highlight Start', 'Recovery', 'Pass Received'],
    correctAnswer: 'Highlight End',
    explanation: 'Highlight End marks when main live board action resumes after non-gameplay footage.',
    difficulty: 'medium',
  },
  {
    scenario:
      'A defender trips an attacker. You pause on the contact frame. Which event do you mark first?',
    options: ['Foul', 'Referee', 'Tackle', 'Recovery'],
    correctAnswer: 'Foul',
    explanation:
      'Mark Foul at +2 frames from the infringement contact. Add Referee later if the whistle is shown.',
    difficulty: 'hard',
  },
  {
    scenario:
      'A high ball drops between two midfielders. Both stay on the ground and neither jumps, though the ball is clearly in the air.',
    options: ['Aerial Duel', 'Pass Received', 'Recovery', 'Pass'],
    correctAnswer: 'Recovery',
    explanation:
      'Do not mark Aerial Duel if no player jumps or clearly attempts to jump, even when the ball is in the air. Mark possession (Recovery/Pass Received) if clear.',
    difficulty: 'hard',
  },
  {
    scenario:
      'After a three-player scramble, one midfielder cleanly traps the ball at their feet while the others are no longer contesting.',
    options: ['Recovery', 'Pass Received', 'Tackle', 'Interception'],
    correctAnswer: 'Recovery',
    explanation:
      'When more than two players are together, only mark Recovery or Pass Received once it is clear which player possessed the ball.',
    difficulty: 'hard',
  },
  {
    scenario:
      'The referee blows the whistle to restart play after the ball went out for a throw-in.',
    options: ['Referee', 'Ball Out of Play', 'Foul', 'Substitution'],
    correctAnswer: 'Referee',
    explanation:
      'Referee at 0f confirms the stoppage. Pair with Ball Out of Play (−1f when the ball crossed the line).',
    difficulty: 'medium',
  },
  {
    scenario:
      'A ball boy kicks a replacement ball onto the pitch and it rolls over the touchline before any player touches it.',
    options: ['Invalid', 'Ball Out of Play', 'Pass', 'Recovery'],
    correctAnswer: 'Invalid',
    explanation:
      'Non-player involvement is Invalid at 0f. Also mark Ball Out of Play at −1f when the ball crosses the line.',
    difficulty: 'hard',
  },
  {
    scenario:
      'The goalkeeper parries a shot. Which event marks the save timing?',
    options: ['Save', 'Block', 'Recovery', 'Clearance'],
    correctAnswer: 'Save',
    explanation: 'Save follows a shot and is marked at −1 frame from the stopping contact.',
    difficulty: 'medium',
  },
];

module.exports = { testQuestions };
