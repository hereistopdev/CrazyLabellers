export function displayAssignmentTitle(assignment, index = 0) {
  const title = assignment?.title?.trim();
  const clipId = assignment?.clipId?.trim();

  if (title && (!clipId || title.toLowerCase() !== clipId.toLowerCase())) {
    return title;
  }

  const order = assignment?.sortOrder > 0 ? assignment.sortOrder : index + 1;
  const kind = assignment?.kind;

  if (kind === 'tutorial') return `Tutorial ${order}`;
  if (kind === 'pretest') return `Pre-test clip ${order}`;
  return title || clipId || `Task ${order}`;
}

export function assignmentSubtitle(assignment) {
  const parts = [];
  if (assignment?.description?.trim()) {
    parts.push(assignment.description.trim());
  }
  if (assignment?.clipId) {
    parts.push(assignment.clipId);
  }
  return parts.join(' · ');
}
