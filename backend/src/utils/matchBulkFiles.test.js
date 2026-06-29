const assert = require('assert');
const { matchBulkFiles } = require('./matchBulkFiles');

function testExactStemNestedLayout() {
  const entries = [
    { name: '3753984_1_p000.mkv' },
    { name: '3753984_1_p001.mkv' },
    { name: '3753984_1_p000.json' },
    { name: '3753984_1_p001.json' },
    { name: '3753984_1_p000_post.json' },
    { name: '3753984_1.json' },
    { name: '3753984_1_old.json' },
  ];

  const { clips, ignored } = matchBulkFiles(entries, { layout: 'nested-clip-batches' });

  assert.strictEqual(clips.length, 2);
  assert.strictEqual(clips[0].clipId, '3753984_1_p000');
  assert.strictEqual(clips[0].postRefName, '3753984_1_p000.json');
  assert.strictEqual(clips[0].rawRefName, '3753984_1_p000_post.json');
  assert.strictEqual(clips[1].postRefName, '3753984_1_p001.json');
  assert.ok(ignored.some((row) => row.name === '3753984_1_old.json'));
  console.log('matchBulkFiles nested layout: ok');
}

testExactStemNestedLayout();
