import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { isAdmin } from '../utils/roles';
import { useAuth } from '../context/AuthContext';
import { formatTimestamp } from '../utils/formatTimestamp';

const STATUS_LABELS = {
  available: 'Available',
  assigned: 'Assigned',
  in_progress: 'In progress',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

export default function ReviewQueue() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [tab, setTab] = useState('videos');
  const [submissions, setSubmissions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSubmissions = () => {
    setLoading(true);
    api
      .getReviewSubmissions(statusFilter)
      .then(setSubmissions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const loadAssignments = () => {
    setLoading(true);
    api
      .getReviewAssignments()
      .then(setAssignments)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tab === 'submissions') loadSubmissions();
    else loadAssignments();
  }, [tab, statusFilter]);

  if (loading) return <div className="loading">Loading review queue...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Review</h1>
        <p>
          Preview uploaded videos with reference annotations, or review labeller submissions.
        </p>
        {admin && (
          <Link to="/admin" style={{ fontSize: '0.88rem' }}>
            ← Admin dashboard
          </Link>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="actions-row" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className={`btn btn-sm${tab === 'videos' ? ' btn-primary' : ' btn-secondary'}`}
          onClick={() => setTab('videos')}
        >
          All videos
        </button>
        <button
          type="button"
          className={`btn btn-sm${tab === 'submissions' ? ' btn-primary' : ' btn-secondary'}`}
          onClick={() => setTab('submissions')}
        >
          Submissions
        </button>
        {tab === 'submissions' && (
          <label className="filter-label" style={{ marginLeft: '0.5rem' }}>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="submitted">Awaiting review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
          </label>
        )}
      </div>

      {tab === 'videos' ? (
        <div className="card table-wrap">
          {assignments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem' }}>
              No videos uploaded yet
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Video</th>
                  <th>Status</th>
                  <th>Reference</th>
                  <th>Submissions</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment._id}>
                    <td>{assignment.title}</td>
                    <td>
                      <span className={`status-pill status-${assignment.status}`}>
                        {STATUS_LABELS[assignment.status] || assignment.status}
                      </span>
                    </td>
                    <td>{assignment.hasReference ? 'Yes' : '—'}</td>
                    <td>{assignment.submissionCount ?? 0}</td>
                    <td>{formatTimestamp(assignment.createdAt)}</td>
                    <td>{formatTimestamp(assignment.updatedAt)}</td>
                    <td>
                      <Link
                        to={`/review/assignment/${assignment._id}`}
                        className="btn btn-primary btn-sm"
                      >
                        Preview video
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="card table-wrap">
          {submissions.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem' }}>
              No submissions in this filter
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Video</th>
                  <th>Labeller</th>
                  <th>Events</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => (
                  <tr key={submission._id}>
                    <td>{submission.assignmentId?.title || '—'}</td>
                    <td>{submission.userId?.name}</td>
                    <td>{submission.events?.length || 0}</td>
                    <td>
                      <span className={`status-pill status-${submission.status}`}>
                        {submission.status}
                      </span>
                    </td>
                    <td>{formatTimestamp(submission.submittedAt || submission.createdAt)}</td>
                    <td>{formatTimestamp(submission.updatedAt)}</td>
                    <td>
                      <Link
                        to={`/review/${submission._id}`}
                        className="btn btn-primary btn-sm"
                      >
                        Review with video
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
