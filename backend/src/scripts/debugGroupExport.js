/**
 * Debug group export for a task group name or id.
 * Run: node src/scripts/debugGroupExport.js 3754221_1
 */
require('dotenv').config();
const mongoose = require('mongoose');
const TaskGroup = require('../models/TaskGroup');
const VideoAssignment = require('../models/VideoAssignment');
const LabelSubmission = require('../models/LabelSubmission');
const { resolveExportBasename } = require('../utils/exportAnnotation');
const { buildGroupSubmissionsExport } = require('../services/groupExport');

async function main() {
  const query = process.argv[2] || '3754221_1';
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);

  let group =
    (await TaskGroup.findById(query).catch(() => null)) ||
    (await TaskGroup.findOne({ name: new RegExp(`^${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }));

  console.log('\n=== Task group ===');
  if (!group) {
    console.log('Group not found for:', query);
    const similar = await TaskGroup.find({ name: /3754221/i }).limit(10);
    console.log(
      'Similar groups:',
      similar.map((g) => ({ id: g._id, name: g.name }))
    );
    await mongoose.disconnect();
    return;
  }
  console.log({ id: group._id, name: group.name });

  const byGroupId = await VideoAssignment.find({ groupId: group._id, kind: 'production' });
  console.log('\n=== Assignments with groupId ===', byGroupId.length);
  for (const a of byGroupId.slice(0, 5)) {
    console.log(' ', a.clipId, a.title, 'status:', a.status);
  }
  if (byGroupId.length > 5) console.log(`  ... and ${byGroupId.length - 5} more`);

  const prefix = group.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const byPrefix = await VideoAssignment.find({
    kind: 'production',
    $or: [
      { clipId: new RegExp(`^${prefix}`, 'i') },
      { title: new RegExp(`^${prefix}`, 'i') },
    ],
  });
  console.log('\n=== Assignments matching group name prefix ===', byPrefix.length);
  const unlinked = byPrefix.filter((a) => String(a.groupId || '') !== String(group._id));
  console.log('  Unlinked to this group:', unlinked.length);

  console.log('\n=== Submissions for groupId assignments ===');
  for (const a of byGroupId) {
    const subs = await LabelSubmission.find({ assignmentId: a._id });
    const basename = resolveExportBasename(a);
    console.log(`\n${a.clipId} (assignment ${a.status}) basename=${basename}`);
    if (!subs.length) {
      console.log('  no submissions');
      continue;
    }
    for (const s of subs) {
      console.log(
        `  submission status=${s.status} events=${s.events?.length || 0} userId=${s.userId}`
      );
    }
  }

  for (const filter of ['all']) {
    console.log(`\n=== buildGroupSubmissionsExport statusFilter=${filter} ===`);
    try {
      const result = await buildGroupSubmissionsExport({
        groupId: group._id,
        variant: 'post',
      });
      console.log('OK:', result.fileCount, 'files', result.files.map((f) => f.path));
    } catch (err) {
      console.log('ERROR:', err.message);
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
