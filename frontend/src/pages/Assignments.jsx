import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../utils/money';

const STATUS_LABELS = {
  available: 'Available',
  assigned: 'Assigned',
  in_progress: 'In progress',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

export default function Assignments() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .getAssignments('production')
      .then(setAssignments)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleClaim = async (id) => {
    setClaiming(id);
    try {
      await api.claimAssignment(id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setClaiming(null);
    }
  };

  if (loading) return <div className="loading">Loading assignments...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Production labeling</h1>
        <p>
          Real 30-second clips for paid labeling. Requires knowledge test (80%+) and labeling
          pre-test (80/100+).
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {assignments.length === 0 ? (
        <div className="empty-state">No assignments available yet.</div>
      ) : (
        <div className="card-grid">
          {assignments.map((a) => {
            const isMine = a.assignedTo?._id === user?.id || a.assignedTo === user?.id;
            const canOpen = isMine && ['assigned', 'in_progress', 'submitted'].includes(a.status);
            const canClaim = a.status === 'available';

            return (
              <div key={a._id} className="card">
                <h3 style={{ marginBottom: '0.35rem' }}>{a.title}</h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  {a.description}
                </p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Duration: {a.durationSeconds}s ·{' '}
                  {a.taskPrice != null && (
                    <span className="task-price-badge">Pays up to {formatMoney(a.taskPrice)}</span>
                  )}{' '}
                  <span className={`status-badge status-${a.status === 'available' ? 'approved' : 'passed_test'}`}>
                    {STATUS_LABELS[a.status] || a.status}
                  </span>
                </p>
                {a.challengeNote && (
                  <p style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: '0.5rem' }}>
                    Challenge: {a.challengeNote}
                  </p>
                )}

                <div className="actions-row">
                  {canClaim && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleClaim(a._id)}
                      disabled={claiming === a._id}
                    >
                      {claiming === a._id ? 'Claiming...' : 'Claim & label'}
                    </button>
                  )}
                  {canOpen && (
                    <Link to={`/label/${a._id}`} className="btn btn-primary btn-sm">
                      Open labeler
                    </Link>
                  )}
                  {a.status === 'submitted' && isMine && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Awaiting review
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
