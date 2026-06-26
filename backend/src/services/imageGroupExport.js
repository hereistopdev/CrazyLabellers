const ImageAssignment = require('../models/ImageAssignment');
const ImageKeypointSubmission = require('../models/ImageKeypointSubmission');
const TaskGroup = require('../models/TaskGroup');
const {
  buildMergedKeypointExportPayload,
  getExportFilename,
  normalizeKeypoints,
  countLabellerExportKeypoints,
} = require('../utils/imageKeypointExport');
const { loadReferenceRawJsonForImage } = require('./imageReferenceStorage');
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
    if (countLabellerExportKeypoints(map) === 0) continue;

    const referenceRaw = loadReferenceRawJsonForImage(assignment.imageId);
    const payload = buildMergedKeypointExportPayload(assignment, map, referenceRaw);
    const filename = getExportFilename(assignment.imageId);
    files.push({
      path: `${folderName}/${filename}`,
      content: JSON.stringify(payload, null, 2),
    });
  }

  if (files.length === 0) {
    const error = new Error(
      'No exportable frames yet — mark kp0–kp8 on at least one frame before downloading'
    );
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
