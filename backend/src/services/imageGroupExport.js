const ImageAssignment = require('../models/ImageAssignment');
const ImageKeypointSubmission = require('../models/ImageKeypointSubmission');
const TaskGroup = require('../models/TaskGroup');
const {
  buildKeypointExportPayload,
  getExportFilename,
  normalizeKeypoints,
  countMarkedKeypoints,
} = require('../utils/imageKeypointExport');
const { sendGroupExportZip, resolveGroupFolderName } = require('./groupExport');

async function loadImageGroupAssignments(groupId) {
  const groupFilter = groupId === 'ungrouped' ? { groupId: null } : { groupId };

  const groupDoc =
    groupId === 'ungrouped'
      ? null
      : await TaskGroup.findById(groupId).select('name description sortOrder');

  if (groupId !== 'ungrouped' && !groupDoc) {
    const error = new Error('Image group not found');
    error.status = 404;
    throw error;
  }

  const group =
    groupId === 'ungrouped'
      ? { _id: null, name: 'Ungrouped images', description: '', sortOrder: 9999 }
      : {
          _id: groupDoc._id,
          name: groupDoc.name,
          description: groupDoc.description || '',
          sortOrder: groupDoc.sortOrder ?? 0,
        };

  const assignments = await ImageAssignment.find(groupFilter)
    .sort({ sortOrder: 1, imageId: 1, title: 1 })
    .lean();

  return { group, assignments };
}

async function buildImageGroupExport({ groupId, userId }) {
  const { group, assignments } = await loadImageGroupAssignments(groupId);
  const folderName = resolveGroupFolderName(group);
  const files = [];

  for (const assignment of assignments) {
    const submission = await ImageKeypointSubmission.findOne({
      assignmentId: assignment._id,
      userId,
    }).lean();

    const map = normalizeKeypoints(submission?.keypoints || []);
    if (countMarkedKeypoints(map) === 0) continue;

    const payload = buildKeypointExportPayload(assignment, map, {
      width: assignment.width,
      height: assignment.height,
    });
    const filename = getExportFilename(assignment.imageId);
    files.push({
      path: `${folderName}/${filename}`,
      content: JSON.stringify(payload, null, 2),
    });
  }

  if (files.length === 0) {
    const error = new Error('No labeled frames to export in this project');
    error.status = 404;
    throw error;
  }

  return {
    folderName,
    zipFilename: `${folderName}_keypoints.zip`,
    files,
    fileCount: files.length,
  };
}

module.exports = {
  buildImageGroupExport,
  loadImageGroupAssignments,
};
