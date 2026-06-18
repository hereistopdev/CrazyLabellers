import { Link } from 'react-router-dom';
import { labelerPath } from '../utils/labelerAccess';

export default function VideoLabelLink({ assignmentId, children, className = 'video-label-link' }) {
  if (!assignmentId) {
    return <span>{children}</span>;
  }

  return (
    <Link to={labelerPath(assignmentId)} className={className}>
      {children}
    </Link>
  );
}
