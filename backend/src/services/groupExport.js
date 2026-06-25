const archiver = require('archiver');
const TaskGroup = require('../models/TaskGroup');
const VideoAssignment = require('../models/VideoAssignment');
const LabelSubmission = require('../models/LabelSubmission');
const { sanitizeClipId } = require('../utils/clipId');
const { exportAnnotation, getExportFilename, resolveExportBasename } = require('../utils/exportAnnotation');
const { normalizeLabelEvents } = require('../utils/normalizeLabelEvents');
const { loadReferenceForClip } = require('./referenceStorage');

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveGroupFolderName(group) {
  const fromName = sanitizeClipId(group?.name);
  if (fromName && fromName.length >= 2) return fromName;
  const id = String(group?._id || '');
  return id ? `group_${id.slice(-8)}` : 'group';
}

function resolveAssigneeId(assignment) {
  const assignedTo = assignment?.assignedTo;
  if (!assignedTo) return null;
  if (typeof assignedTo === 'object' && assignedTo._id) return assignedTo._id;
  return assignedTo;
}

function submissionHasEvents(submission) {
  return Boolean(submission?.events?.length || submission?.originalEvents?.length);
}

function getSubmissionEvents(submission) {
  if (!submission) return [];
  if (submission.events?.length) return submission.events;
  if (submission.originalEvents?.length) return submission.originalEvents;
  return [];
}

function buildExportFile({ assignment, events, variant }) {
  const exportBasename = resolveExportBasename(assignment);
  if (!exportBasename) return null;

  const normalized = normalizeLabelEvents(events);
  if (!normalized.length) return null;

  const exportVariant = variant === 'raw' ? 'raw' : 'post';
  const payload = exportAnnotation(normalized, {
    gameTime: assignment.gameTime || '1 - 00:00',
    variant: exportVariant,
  });
  const filename = getExportFilename(exportBasename, exportVariant);

  return {
    filename,
    content: JSON.stringify(payload, null, 2),
  };
}

async function loadGroupAssignments(groupId) {
  const group = await TaskGroup.findById(groupId);
  if (!group) {
    const error = new Error('Group not found');
    error.status = 404;
    throw error;
  }

  const byGroupId = await VideoAssignment.find({
    groupId: group._id,
    kind: 'production',
  })
    .sort({ sortOrder: 1, clipId: 1, title: 1 })
    .lean();

  const prefix = sanitizeClipId(group.name);
  const assignments = [...byGroupId];
  const seen = new Set(assignments.map((row) => String(row._id)));

  if (prefix) {
    const prefixPattern = new RegExp(`^${escapeRegex(prefix)}(?:_|$)`, 'i');
    const byPrefix = await VideoAssignment.find({
      kind: 'production',
      $or: [{ clipId: prefixPattern }, { title: prefixPattern }],
    })
      .sort({ sortOrder: 1, clipId: 1, title: 1 })
      .lean();

    for (const row of byPrefix) {
      const key = String(row._id);
      if (!seen.has(key)) {
        assignments.push(row);
        seen.add(key);
      }
    }
  }

  assignments.sort(
    (a, b) =>
      (a.sortOrder || 0) - (b.sortOrder || 0) ||
      String(a.clipId || a.title || '').localeCompare(String(b.clipId || b.title || ''))
  );

  return { group, assignments };
}

async function findSubmissionForGroupExport(assignment) {
  const assignmentId = assignment._id;
  const assigneeId = resolveAssigneeId(assignment);
  const nonEmptyEvents = { $expr: { $gt: [{ $size: { $ifNull: ['$events', []] } }, 0] } };

  const pick = (filter) =>
    LabelSubmission.findOne({ assignmentId, ...filter, ...nonEmptyEvents }).sort({
      reviewedAt: -1,
      updatedAt: -1,
    });

  let submission = await pick({ status: 'approved' });
  if (submission) return submission;

  if (assigneeId) {
    submission = await pick({ userId: assigneeId });
    if (submission) return submission;
  }

  if (assignment.status === 'approved') {
    submission = await pick({});
    if (submission) return submission;
  }

  submission = await pick({ status: 'submitted' });
  if (submission) return submission;

  submission = await LabelSubmission.findOne({ assignmentId, ...nonEmptyEvents }).sort({
    updatedAt: -1,
  });
  if (submission) return submission;

  submission = await LabelSubmission.findOne({ assignmentId }).sort({ updatedAt: -1 });
  if (submissionHasEvents(submission)) return submission;

  return null;
}

async function buildExportFileForAssignment(assignment, { variant = 'post' } = {}) {
  const submission = await findSubmissionForGroupExport(assignment);
  const submissionEvents = getSubmissionEvents(submission);
  if (submissionEvents.length) {
    return buildExportFile({ assignment, events: submissionEvents, variant });
  }

  if (!assignment.clipId) return null;

  const exportVariant = variant === 'raw' ? 'raw' : 'post';
  const reference = await loadReferenceForClip(assignment.clipId, exportVariant);
  if (reference.hasReference && reference.events?.length) {
    return buildExportFile({ assignment, events: reference.events, variant });
  }

  return null;
}

async function buildLabellerGroupExport({ groupId, userId, variant = 'post' }) {
  const { group, assignments } = await loadGroupAssignments(groupId);
  const folderName = resolveGroupFolderName(group);
  const files = [];

  for (const assignment of assignments) {
    const submission = await LabelSubmission.findOne({
      assignmentId: assignment._id,
      userId,
    });
    const events = getSubmissionEvents(submission);
    const file = buildExportFile({ assignment, events, variant });
    if (file) {
      files.push({ path: `${folderName}/${file.filename}`, content: file.content });
    }
  }

  if (files.length === 0) {
    const error = new Error('No labeled clips found in this group');
    error.status = 404;
    throw error;
  }

  return {
    folderName,
    zipFilename: `${folderName}.zip`,
    files,
    fileCount: files.length,
  };
}

async function buildGroupSubmissionsExport({ groupId, variant = 'post' }) {
  const { group, assignments } = await loadGroupAssignments(groupId);
  const folderName = resolveGroupFolderName(group);
  const files = [];
  let approvedAssignmentCount = 0;
  let labeledAssignmentCount = 0;

  for (const assignment of assignments) {
    if (assignment.status === 'approved') approvedAssignmentCount += 1;

    const file = await buildExportFileForAssignment(assignment, { variant });
    if (file) {
      labeledAssignmentCount += 1;
      files.push({ path: `${folderName}/${file.filename}`, content: file.content });
    }
  }

  if (files.length === 0) {
    let message = 'No exportable JSON found in this group';
    if (assignments.length === 0) {
      message = `No production clips found for group "${group.name}". Assign clips to this group or check the group name prefix.`;
    } else if (approvedAssignmentCount > 0) {
      message = `Found ${approvedAssignmentCount} approved clip(s) in "${group.name}" but none have exportable events yet.`;
    } else {
      message = `Found ${assignments.length} clip(s) in "${group.name}" but none have labeled or reference JSON to export.`;
    }
    const error = new Error(message);
    error.status = 404;
    throw error;
  }

  return {
    folderName,
    zipFilename: `${folderName}.zip`,
    files,
    fileCount: files.length,
    assignmentCount: assignments.length,
    labeledAssignmentCount,
  };
}

function sendGroupExportZip(res, { zipFilename, files }) {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).json({ message: err.message });
    }
  });
  archive.pipe(res);

  for (const file of files) {
    archive.append(file.content, { name: file.path });
  }

  return archive.finalize();
}

module.exports = {
  buildLabellerGroupExport,
  buildGroupSubmissionsExport,
  sendGroupExportZip,
  resolveGroupFolderName,
  loadGroupAssignments,
};
