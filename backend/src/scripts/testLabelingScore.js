/**
 * Run: node src/scripts/testLabelingScore.js
 * Validates auto-scoring against known reference/submission pairs.
 */
const { parseReferenceAnnotation } = require('../utils/parseReferenceAnnotation');
const {
  computeLabelingScore,
  scoreForFrameDiff,
  PASS_THRESHOLD,
  FRAME_SCORE_STEP,
} = require('../utils/labelingScore');
const { DEFAULT_TOLERANCE_MS } = require('../utils/compareAnnotations');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${message}`);
  }
}

function parsePair(refAnnotations, subAnnotations) {
  return {
    reference: parseReferenceAnnotation({ annotations: refAnnotations }),
    submission: parseReferenceAnnotation({ annotations: subAnnotations }),
  };
}

function runExample(name, refAnnotations, subAnnotations, expected) {
  console.log(`\n${name}`);
  const { reference, submission } = parsePair(refAnnotations, subAnnotations);
  const result = computeLabelingScore(submission, reference, 25);

  console.log(`  Reference events: ${reference.length} · Submission events: ${submission.length}`);
  console.log(`  Matched: ${result.matchedCount} · Missing: ${result.missingCount} · Extra: ${result.extraCount}`);
  console.log(`  Total score: ${result.totalScore}/100 · Pass threshold: ${PASS_THRESHOLD} · Passed: ${result.passed}`);

  result.breakdown.forEach((row) => {
    const detail =
      row.status === 'missing'
        ? 'MISSING → 0'
        : `${row.frameDiff}f off · ${row.timeDiffMs}ms → ${row.score}`;
    console.log(`    · ${row.eventType}: ${detail}`);
  });

  if (expected.totalScore != null) {
    assert(result.totalScore === expected.totalScore, `total score = ${expected.totalScore}`);
  }
  if (expected.passed != null) {
    assert(result.passed === expected.passed, `passed = ${expected.passed}`);
  }
  if (expected.matchedCount != null) {
    assert(result.matchedCount === expected.matchedCount, `matched count = ${expected.matchedCount}`);
  }
  if (expected.breakdownScores) {
    expected.breakdownScores.forEach((score, index) => {
      assert(result.breakdown[index]?.score === score, `event ${index + 1} score = ${score}`);
    });
  }

  return result;
}

console.log('Labeling score tests');
console.log(`  Tolerance: ${DEFAULT_TOLERANCE_MS}ms · Frame step: −${FRAME_SCORE_STEP}/frame`);

console.log('\nUnit: scoreForFrameDiff');
assert(scoreForFrameDiff(0) === 100, '0 frames → 100');
assert(scoreForFrameDiff(1) === 95, '1 frame → 95');
assert(scoreForFrameDiff(2) === 90, '2 frames → 90');
assert(scoreForFrameDiff(3) === 85, '3 frames → 85');
assert(scoreForFrameDiff(4) === 80, '4 frames → 80');
assert(scoreForFrameDiff(6) === 70, '6 frames → 70');
assert(scoreForFrameDiff(20) === 0, '20 frames → 0');
assert(scoreForFrameDiff(25) === 0, '25+ frames → 0');

// User example from conversation (near-correct submission)
const USER_REF = [
  { label: 'PASS', position: '3120' },
  { label: 'PASS_RECEIVED', position: '5680' },
  { label: 'PASS', position: '12360' },
  { label: 'CLEARANCE', position: '13680' },
  { label: 'BALL_OUT_OF_PLAY', position: '17360' },
];

const USER_SUB = [
  { label: 'PASS', position: '3232' },
  { label: 'PASS_RECEIVED', position: '5911' },
  { label: 'PASS', position: '12400' },
  { label: 'CLEARANCE', position: '13760' },
  { label: 'BALL_OUT_OF_PLAY', position: '17358' },
];

runExample('User example — near-match submission', USER_REF, USER_SUB, {
  totalScore: 88,
  passed: true,
  matchedCount: 5,
  breakdownScores: [85, 70, 95, 90, 100],
});

runExample('User example — identical submission', USER_REF, USER_REF, {
  totalScore: 100,
  passed: true,
  matchedCount: 5,
  breakdownScores: [100, 100, 100, 100, 100],
});

runExample('User example — empty submission', USER_REF, [], {
  totalScore: 0,
  passed: false,
  matchedCount: 0,
});

// Pass Received 276ms off reference (5680 vs 5956) — outside 250ms tolerance
runExample('Pass Received outside tolerance', USER_REF, [
  { label: 'PASS', position: '3232' },
  { label: 'PASS_RECEIVED', position: '5956' },
  { label: 'PASS', position: '12400' },
  { label: 'CLEARANCE', position: '13760' },
  { label: 'BALL_OUT_OF_PLAY', position: '17358' },
], {
  matchedCount: 4,
  breakdownScores: [85, 0, 95, 90, 100],
});

// Wrong event type on one row
runExample('Wrong label on Pass Received', USER_REF, [
  { label: 'PASS', position: '3120' },
  { label: 'PASS', position: '5680' },
  { label: 'PASS', position: '12360' },
  { label: 'CLEARANCE', position: '13680' },
  { label: 'BALL_OUT_OF_PLAY', position: '17360' },
], {
  matchedCount: 4,
  totalScore: 80,
  passed: true,
  breakdownScores: [100, 0, 100, 100, 100],
});

console.log(`\n${'—'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
