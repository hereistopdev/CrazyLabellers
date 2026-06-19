const TaskGroup = require('../models/TaskGroup');

async function resolveUploadGroupId({ groupId, newGroupName, kind = 'production' } = {}) {
  if (kind !== 'production') {
    return null;
  }

  const trimmedName = newGroupName?.trim();
  if (trimmedName) {
    const escaped = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let group = await TaskGroup.findOne({ name: { $regex: new RegExp(`^${escaped}$`, 'i') } });
    if (!group) {
      group = await TaskGroup.create({ name: trimmedName });
    }
    return group._id;
  }

  if (groupId) {
    const group = await TaskGroup.findById(groupId);
    if (!group) {
      const error = new Error('Task group not found');
      error.status = 404;
      throw error;
    }
    return group._id;
  }

  return null;
}

module.exports = { resolveUploadGroupId };
