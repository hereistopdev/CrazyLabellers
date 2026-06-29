import { frameOffsetSummary } from '../config/frameOffsets';

export const LABELING_GUIDE_SECTIONS = [
  {
    id: 'workflow',
    title: 'How to label a clip',
    items: [
      'All clips are 25 fps (40 ms per frame). Pause on the exact frame, then press Enter or M to open the event picker.',
      'Each mark auto-saves as a draft. Use Insert on a selected event to change its type, or Del to remove it.',
      `Frame offsets: ${frameOffsetSummary}. Immediate follow-up events (e.g. Pass → Pass Received) use offset 0 at the touch.`,
      'Submit is blocked on Critical, Very bad, and Bad findings. Recommended and Suspicious are warnings only.',
    ],
  },
  {
    id: 'validation-levels',
    title: 'Validation severity (matches rule checker)',
    items: [
      'Critical — blocks submit: min gap < 2 frames, highlight/take-on pairing, take-on timing, foul/ball-out → referee timing.',
      'Very bad — blocks submit: Pass Received/Recovery as first event, after Highlight End, Clearance not followed by Recovery.',
      'Bad — blocks submit: Tackle → Foul gap not in 4, 6, 8, 10, or 12 frames.',
      'Recommended — warning only: long gap after Pass Received/Recovery may mean a missing Take on.',
      'Suspicious — warning only: consecutive Pass, Pass→Tackle, missing recovery after tackle/interception, missing referee after foul/ball out.',
    ],
  },
  {
    id: 'spacing',
    title: 'Frame spacing (Critical)',
    items: [
      'Only one event per frame.',
      'At least 2 frames (80 ms) between any two consecutive events.',
      'Take on → Take on End: paired, ≥ 6 even frames apart.',
      'Tackle → Foul: nearest tackle within 24 frames; gap must be exactly 4, 6, 8, 10, or 12 frames (skip if Foul follows Pass).',
      'Foul / Ball Out of Play → Referee: within 150 frames, gap ≥ 4 and even.',
    ],
  },
  {
    id: 'highlights',
    title: 'Highlight Start & Highlight End',
    items: [
      'Highlight Start/End must pair correctly (stack order, no orphan markers).',
      'Events inside a highlight window are ignored for gameplay checks — fix boundaries so real play sits outside.',
      'Pass Received or Recovery must NOT immediately follow Highlight End (Very bad).',
    ],
  },
  {
    id: 'possession',
    title: 'Pass, Pass Received, Recovery',
    items: [
      'Pass Received or Recovery must not be the first event (after highlights stripped).',
      'After Tackle, Interception, Aerial Duel, or Clearance the next event should usually be Recovery — many exceptions apply (see rule checker).',
      'Clearance → Pass Received is allowed (same team); Clearance without Recovery/Pass Received is Very bad.',
      'Consecutive Pass or Pass→Tackle is Suspicious (does not block submit).',
    ],
  },
  {
    id: 'tackle-foul',
    title: 'Tackle, Foul, Referee',
    items: [
      'Advantage: if play continues, remove Foul and do not add Referee for that incident.',
      'Referee when the whistle stops play — including offside (no Foul).',
      'Foul or Ball Out of Play should be followed by Referee within 150 frames.',
    ],
  },
  {
    id: 'submit',
    title: 'Submit checklist',
    items: [
      'No Critical / Very bad / Bad findings in the validation panel.',
      'Highlight and Take on pairs closed correctly.',
      'Min 2-frame gap between all events (outside highlights).',
      'First event is not Pass Received or Recovery.',
      'No Pass Received/Recovery right after Highlight End.',
      'Clearance followed by Recovery or Pass Received.',
      'Review Suspicious/Recommended warnings even when submit is allowed.',
    ],
  },
];

export const LABELING_GUIDE_QUICK_LINKS = [
  { label: 'Event definitions', to: '/terminology' },
  { label: 'Frequent Q&A', to: '/faq' },
  { label: 'Knowledge test', to: '/test' },
  { label: 'Tutorials', to: '/tutorials' },
];
