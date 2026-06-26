const ImageAssignment = require('../models/ImageAssignment');
const ImageKeypointSubmission = require('../models/ImageKeypointSubmission');
const { deleteImageFile } = require('./imageStorage');
const { deleteReferenceForImage } = require('./imageReferenceStorage');

async function deleteImageAssignmentRecord(assignment) {
  await ImageKeypointSubmission.deleteMany({ assignmentId: assignment._id });
  await deleteImageFile(assignment.imageId);
  deleteReferenceForImage(assignment.imageId);
  await ImageAssignment.findByIdAndDelete(assignment._id);
}

async function deleteImageAssignmentsByFilter(filter) {
  const assignments = await ImageAssignment.find(filter);
  for (const assignment of assignments) {
    await deleteImageAssignmentRecord(assignment);
  }
  return assignments.length;
}

module.exports = {
  deleteImageAssignmentRecord,
  deleteImageAssignmentsByFilter,
};
