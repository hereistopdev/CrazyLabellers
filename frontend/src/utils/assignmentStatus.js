export const ASSIGNMENT_STATUS_LABELS = {
  available: 'Available',
  assigned: 'Assigned',
  in_progress: 'In progress',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function assignmentStatusLabel(status) {
  if (!status) return '—';
  return ASSIGNMENT_STATUS_LABELS[status] || status.replace(/_/g, ' ');
}
