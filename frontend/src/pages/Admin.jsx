import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { formatMoney } from '../utils/money';

function ReviewModal({ submission, ratePerPoint, currency, onClose, onSubmit }) {
  const [reviewPoints, setReviewPoints] = useState(80);
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const earnings = Math.round(reviewPoints * ratePerPoint * 100) / 100;

  const handleApprove = async () => {
    setSubmitting(true);
    await onSubmit(submission._id, {
      status: 'approved',
      reviewPoints,
      reviewerNotes,
    });
    setSubmitting(false);
  };

  const handleReject = async () => {
    setSubmitting(true);
    await onSubmit(submission._id, {
      status: 'rejected',
      reviewPoints: 0,
      reviewerNotes,
    });
    setSubmitting(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>Review submission</h3>
        <p className="modal-sub">
          <strong>{submission.userId?.name}</strong> — {submission.assignmentId?.title}
        </p>
        <p className="modal-sub">{submission.events?.length || 0} events labeled</p>

        <div className="form-group">
          <label>Review points (0–100)</label>
          <input
            type="range"
            min="0"
            max="100"
            value={reviewPoints}
            onChange={(e) => setReviewPoints(parseInt(e.target.value, 10))}
            className="points-slider"
          />
          <div className="points-display">
            <strong>{reviewPoints}</strong> points → {formatMoney(earnings, currency)}
          </div>
        </div>

        <div className="form-group">
          <label>Review notes</label>
          <textarea
            rows={3}
            value={reviewerNotes}
            onChange={(e) => setReviewerNotes(e.target.value)}
            placeholder="Feedback for the labeller..."
          />
        </div>

        <div className="actions-row">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={handleReject} disabled={submitting}>
            Reject (0 pts)
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleApprove} disabled={submitting}>
            Approve — {formatMoney(earnings, currency)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [ratePerPoint, setRatePerPoint] = useState(0.1);
  const [currency, setCurrency] = useState('USD');
  const [reviewing, setReviewing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    description: '',
    videoUrl: '',
    durationSeconds: 30,
  });

  const load = () => {
    Promise.all([api.getAdminStats(), api.getSubmissions(), api.getFinanceSettings()])
      .then(([s, sub, settings]) => {
        setStats(s);
        setSubmissions(sub);
        setRatePerPoint(settings.ratePerPoint);
        setCurrency(settings.currency || 'USD');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const reviewSubmission = async (id, body) => {
    try {
      await api.reviewSubmission(id, body);
      setReviewing(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const createAssignment = async (e) => {
    e.preventDefault();
    try {
      await api.createAssignment(newAssignment);
      setNewAssignment({ title: '', description: '', videoUrl: '', durationSeconds: 30 });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="loading">Loading admin panel...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Admin Panel</h1>
        <p>Review submissions with points, manage assignments, and track payouts.</p>
        <div className="actions-row" style={{ marginTop: '0.5rem' }}>
          <Link to="/admin/labellers" className="btn btn-primary btn-sm">
            Manage labellers
          </Link>
          <Link to="/admin/finance" className="btn btn-secondary btn-sm">
            Finance dashboard
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {stats && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="value">{stats.labellerCount}</div>
            <div className="label">Labellers</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.pendingCount}</div>
            <div className="label">Pending approval</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.approvedCount}</div>
            <div className="label">Approved</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.submissionCount}</div>
            <div className="label">Awaiting review</div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Add video assignment</h3>
        <form onSubmit={createAssignment}>
          <div className="form-group">
            <label>Title</label>
            <input
              value={newAssignment.title}
              onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <input
              value={newAssignment.description}
              onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Video URL</label>
            <input
              value={newAssignment.videoUrl}
              onChange={(e) => setNewAssignment({ ...newAssignment, videoUrl: e.target.value })}
              required
              placeholder="https://..."
            />
          </div>
          <div className="form-group">
            <label>Duration (seconds)</label>
            <input
              type="number"
              value={newAssignment.durationSeconds}
              onChange={(e) =>
                setNewAssignment({ ...newAssignment, durationSeconds: parseInt(e.target.value, 10) })
              }
            />
          </div>
          <button type="submit" className="btn btn-primary btn-sm">
            Create assignment
          </button>
        </form>
      </div>

      <h2 style={{ fontSize: '1.15rem', marginBottom: '0.75rem' }}>
        Submissions to review
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: 8 }}>
          ({formatMoney(ratePerPoint, currency)} per point)
        </span>
      </h2>
      <div className="card table-wrap">
        {submissions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem' }}>
            No pending submissions
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Video</th>
                <th>Labeller</th>
                <th>Events</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s._id}>
                  <td>{s.assignmentId?.title || '—'}</td>
                  <td>{s.userId?.name}</td>
                  <td>{s.events?.length || 0}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setReviewing(s)}
                    >
                      Review & score
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {reviewing && (
        <ReviewModal
          submission={reviewing}
          ratePerPoint={ratePerPoint}
          currency={currency}
          onClose={() => setReviewing(null)}
          onSubmit={reviewSubmission}
        />
      )}
    </div>
  );
}
