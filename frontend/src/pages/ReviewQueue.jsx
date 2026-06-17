import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { isAdmin } from '../utils/roles';
import { useAuth } from '../context/AuthContext';

export default function ReviewQueue() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [submissions, setSubmissions] = useState([]);
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api
      .getReviewSubmissions(statusFilter)
      .then(setSubmissions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [statusFilter]);

  if (loading) return <div className="loading">Loading review queue...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Review submissions</h1>
        <p>
          Open a submission to watch the video, compare against reference annotations when available,
          and validate each event.
        </p>
        {admin && (
          <Link to="/admin" style={{ fontSize: '0.88rem' }}>
            ← Admin dashboard
          </Link>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="actions-row" style={{ marginBottom: '1rem' }}>
        <label className="filter-label">
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="submitted">Awaiting review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>

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
    </div>
  );
}
