const mongoose = require('mongoose');
const VideoAssignment = require('../models/VideoAssignment');
const { normalizeTutorialSteps } = require('../utils/normalizeTutorialSteps');

async function updateAssignmentFields(id, fields) {
  if (!fields || Object.keys(fields).length === 0) return null;

  const update = { ...fields };
  if (update.tutorialSteps !== undefined) {
    update.tutorialSteps = normalizeTutorialSteps(update.tutorialSteps);
  }

  await VideoAssignment.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(String(id)) },
    { $set: update }
  );

  return VideoAssignment.findById(id)
    .populate('groupId', 'name')
    .populate('assignedTo', 'name email')
    .populate('uploadedBy', 'name email')
    .populate('referenceUpdatedBy', 'name email')
    .populate('reviewedBy', 'name email');
}

module.exports = { updateAssignmentFields };
