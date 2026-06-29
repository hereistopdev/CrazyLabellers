import { frameOffsetSummary } from '../config/frameOffsets';
import { PAIR_MAX_GAP } from '../utils/eventSpacingValidation';

export const LABELING_GUIDE_SECTIONS = [
  {
    id: 'workflow',
    title: 'How to label a clip',
    items: [
      'All clips are 25 fps. Pause on the exact frame, then press Enter or M to open the event picker.',
      'Each mark auto-saves as a draft. Use Insert on a selected event to change its type, or Del to remove it.',
      'Use the timeline or event list to jump to a mark. Flag uncertain events for validator discussion.',
      `Frame offsets: ${frameOffsetSummary}. Immediate follow-up events (e.g. Pass → Pass Received) use offset 0 at the touch.`,
      'Before submitting, fix every item listed in the validation panel — spacing rules and football rules both block submit.',
    ],
  },
  {
    id: 'spacing',
    title: 'Frame spacing (required)',
    items: [
      'Only one event per frame.',
      'Leave at least one blank frame between any two events (no consecutive frames).',
      `Paired timings within ${PAIR_MAX_GAP} frames must have a gap of ≥ 6 even frames:`,
      'Take on → Take on End',
      'Tackle → Foul',
      'Foul → Referee',
      'Ball Out of Play → Referee',
      `If the pair is more than ${PAIR_MAX_GAP} frames apart, the even-frame gap rule does not apply — but the events should still make football sense.`,
    ],
  },
  {
    id: 'possession',
    title: 'Pass, Pass Received, Recovery',
    items: [
      'Pass: deliberate kick or throw to a teammate.',
      'Pass Received: teammate gains control after a deliberate pass from their own team.',
      'Recovery: a player gains possession when no team had it, or after an opponent directs the ball to them (not an active interception attempt).',
      'Recovery and Pass Received must NOT be the first event in the clip. Start with Pass, Tackle, Ball Out of Play, Highlight Start, or another valid opener.',
      'Recovery and Pass Received must NOT come immediately after Highlight End. Either remove them or extend the highlight segment to include them.',
      'BAD pattern (almost always wrong): Pass → Pass → Pass Received → Pass Received in a row. Review each mark in that chain.',
    ],
  },
  {
    id: 'clearance',
    title: 'Clearance follow-up',
    items: [
      'Clearance: defensive kick or header that removes immediate danger in the goal section (penalty area / defensive box).',
      'After a Clearance, mark what happens next:',
      'Same team receives the ball → Pass Received',
      'Opponent gains possession → Recovery',
      'If unsure and the event falls inside a replay segment, you may place Recovery or Pass Received inside the highlight period as a last resort — but prefer fixing Highlight Start / Highlight End first.',
    ],
  },
  {
    id: 'highlights',
    title: 'Highlight Start & Highlight End',
    items: [
      'Highlight Start: footage leaves the main live match board — replays, crowd shots, tunnel, graphics, etc.',
      'Highlight End: live match action on the main board resumes.',
      'Every Highlight Start needs a matching Highlight End before normal play labeling continues.',
      'Do NOT place gameplay events inside a highlight segment (between Start and End). That includes Pass, Pass Received, Recovery, Tackle, Shot, Foul, Referee, and all other on-pitch events.',
      'Highlight boundaries are often mis-marked in reference data. Double-check: if real play happens during a “replay” segment, widen or move Highlight Start / Highlight End so live events sit outside.',
      'Worst case: if Recovery or Pass Received truly belongs in non-board footage, keep it inside the highlight window rather than immediately after Highlight End.',
    ],
  },
  {
    id: 'tackle-foul',
    title: 'Tackle, Foul, Referee & advantage',
    items: [
      'Tackle only: challenge while play continues — no whistle for that incident.',
      'Tackle + Foul + Referee: ball carrier (often after Pass Received or Recovery) is tackled and the referee stops play.',
      'Foul only: foul after the pass is already complete and the receiver no longer has the ball.',
      'Advantage: if the referee lets play continue, remove the Foul — do NOT add Referee for that incident.',
      'Referee: mark at the whistle when play actually stops — even without a clear Foul (e.g. offside, indirect restart). Do not mark Referee for advantage.',
      'Pair Referee with Foul, Ball Out of Play, or Goal when the whistle confirms that stoppage. Offside stoppages: Referee only (no Foul).',
      'Never label offside as Foul.',
    ],
  },
  {
    id: 'other-pairs',
    title: 'Other common pairs',
    items: [
      'Take on when the attacker commits to beating a defender; Take on End when the duel is clearly over.',
      'Interception: defending player cuts out a pass near the intended receiver.',
      'Interception 2: clear interception farther from the intended target.',
      'Ball Out of Play when the ball leaves the field; pair with Referee when the whistle confirms the restart.',
      'Goal always with Shot at the same frame; pair Referee when the whistle confirms the goal.',
      'Invalid when the ball goes to/from non-players (staff, ball crew); pair Ball Out of Play when the ball leaves the field.',
    ],
  },
  {
    id: 'submit',
    title: 'Submit checklist',
    items: [
      'No two events on the same frame; blank frame between consecutive marks.',
      'Paired events respect timing rules where applicable.',
      'First event is not Recovery or Pass Received.',
      'No Recovery / Pass Received directly after Highlight End.',
      'No gameplay events trapped inside highlight segments.',
      'No Foul when play continues (advantage).',
      'Referee marked when the whistle stops play (including offside).',
      'No Pass → Pass → Pass Received → Pass Received chain.',
      'Clearance follow-ups use Pass Received (same team) or Recovery (opponent).',
    ],
  },
];

export const LABELING_GUIDE_QUICK_LINKS = [
  { label: 'Event definitions', to: '/terminology' },
  { label: 'Frequent Q&A', to: '/faq' },
  { label: 'Knowledge test', to: '/test' },
  { label: 'Tutorials', to: '/tutorials' },
];
