const ImageAssignment = require('../models/ImageAssignment');
const ImageKeypointSubmission = require('../models/ImageKeypointSubmission');
const TaskGroup = require('../models/TaskGroup');
const {
  buildMergedKeypointExportPayload,
  getExportFilename,
  normalizeKeypoints,
  countMarkedKeypoints,
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

async function buildImageGroupExport({ groupId, userId, draft = false, submissionRows = null }) {
  const { group, assignments } = await loadImageGroupAssignments(groupId);
  const folderName = resolveGroupFolderName(group);
  const files = [];

  const overrideMap = Array.isArray(submissionRows)
    ? new Map(submissionRows.map((row) => [String(row.assignmentId), row]))
    : null;

  const targets = overrideMap
    ? assignments.filter((row) => overrideMap.has(String(row._id)))
    : assignments;

  for (const assignment of targets) {
    const override = overrideMap?.get(String(assignment._id));
    let map;

    if (override) {
      const rawKeypoints = Array.isArray(override.keypointsList)
        ? override.keypointsList
        : Array.isArray(override.keypoints)
          ? override.keypoints
          : override.keypoints || override.keypointsList || [];
      map = normalizeKeypoints(rawKeypoints);
      if (override.width) assignment.width = override.width;
      if (override.height) assignment.height = override.height;
    } else {
      const submission = await ImageKeypointSubmission.findOne({
        assignmentId: assignment._id,
        userId,
      }).lean();
      map = normalizeKeypoints(submission?.keypoints || []);
    }

    const exportable = draft
      ? countMarkedKeypoints(map) > 0
      : countLabellerExportKeypoints(map) > 0;
    if (!exportable) continue;

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
      draft
        ? 'Nothing to download yet — mark at least one point first'
        : 'No exportable frames yet — mark kp0–kp8 on at least one frame before downloading'
    );
    error.status = 404;
    throw error;
  }

  return {
    folderName,
    zipFilename: draft ? `${folderName}_draft_keypoints.zip` : `${folderName}_keypoints.zip`,
    files,
    fileCount: files.length,
  };
}

module.exports = {
  buildImageGroupExport,
  loadImageGroupAssignments,
};
