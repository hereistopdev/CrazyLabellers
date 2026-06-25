const archiver = require('archiver');
const TaskGroup = require('../models/TaskGroup');
const VideoAssignment = require('../models/VideoAssignment');
const LabelSubmission = require('../models/LabelSubmission');
const { sanitizeClipId } = require('../utils/clipId');
const { exportAnnotation, getExportFilename, resolveExportBasename } = require('../utils/exportAnnotation');

function resolveGroupFolderName(group) {
  const fromName = sanitizeClipId(group?.name);
  if (fromName && fromName.length >= 2) return fromName;
  const id = String(group?._id || '');
  return id ? `group_${id.slice(-8)}` : 'group';
}

function buildExportFile({ assignment, submission, variant }) {
  const exportBasename = resolveExportBasename(assignment);
  if (!exportBasename || !submission?.events?.length) return null;

  const exportVariant = variant === 'raw' ? 'raw' : 'post';
  const payload = exportAnnotation(submission.events, {
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

  const assignments = await VideoAssignment.find({
    groupId: group._id,
    kind: 'production',
  }).sort({ sortOrder: 1, clipId: 1, title: 1 });

  return { group, assignments };
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
    const file = buildExportFile({ assignment, submission, variant });
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

async function buildApprovedGroupExport({ groupId, variant = 'post' }) {
  const { group, assignments } = await loadGroupAssignments(groupId);
  const folderName = resolveGroupFolderName(group);
  const files = [];

  for (const assignment of assignments) {
    const submission = await LabelSubmission.findOne({
      assignmentId: assignment._id,
      status: 'approved',
    }).sort({ reviewedAt: -1, updatedAt: -1 });

    const file = buildExportFile({ assignment, submission, variant });
    if (file) {
      files.push({ path: `${folderName}/${file.filename}`, content: file.content });
    }
  }

  if (files.length === 0) {
    const error = new Error('No approved submissions found in this group');
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
  buildApprovedGroupExport,
  sendGroupExportZip,
  resolveGroupFolderName,
};
