export function getUserId(user) {
  if (!user) return '';
  return String(user.id || user._id || '');
}

export function isAssignedToUser(assignedTo, user) {
  const userId = getUserId(user);
  if (!userId || !assignedTo) return false;
  return String(assignedTo._id || assignedTo) === userId;
}
