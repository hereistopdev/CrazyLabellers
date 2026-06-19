import { assignmentStatusLabel } from '../utils/assignmentStatus';

export default function AssignmentStatusBadge({ status }) {
  if (!status) return '—';

  return (
    <span className={`status-badge status-${status}`}>{assignmentStatusLabel(status)}</span>
  );
}
