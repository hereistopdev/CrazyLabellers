import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatTimestamp } from '../utils/formatTimestamp';
import { displayAssignmentTitle, assignmentSubtitle } from '../utils/displayTitle';

export default function Tutorials() {
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.getTutorialStatus(), api.getTutorialAssignments()])
      .then(([s, list]) => {
        setStatus(s);
        setAssignments(list);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    refreshUser().catch(() => {});
  }, []);

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

  if (loading) return <div className="loading">Loading tutorials...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Labeling tutorials</h1>
        <p>
          Practice with guided examples. Each clip explains <strong>why</strong> an event belongs on
          a specific frame. Complete all tutorials to unlock the 3-clip pre-test.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stat-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="stat-card">
          <div className="value">
            {status?.completed ?? 0}/{status?.total ?? 0}
          </div>
          <div className="label">Tutorials completed</div>
        </div>
        <div className="stat-card">
          <div className="value">{status?.tutorialsCompleted ? 'Done' : 'In progress'}</div>
          <div className="label">Status</div>
        </div>
      </div>

      {status?.tutorialsCompleted ? (
        <div className="alert alert-success">
          All tutorials complete!{' '}
          <Link to="/labeling-test">Continue to labeling pre-test (3 clips)</Link>
        </div>
      ) : (
        <div className="alert alert-info">
          Watch each clip, read the frame explanations, label the events, then submit to mark complete.
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="empty-state">No tutorial clips configured yet.</div>
      ) : (
        <div className="task-list">
          {assignments.map((a, index) => {
            const canOpen = a.assignedTo && ['assigned', 'in_progress'].includes(a.status);
            const canClaim = a.status === 'available' && !a.tutorialCompleted;
            const subtitle = assignmentSubtitle(a);

            return (
              <div key={a._id} className="task-list-item card">
                <div className="task-list-body">
                  <div className="task-list-title-row">
                    <h3>{displayAssignmentTitle(a, index)}</h3>
                    {a.tutorialCompleted && (
                      <span className="status-badge status-approved">Completed</span>
                    )}
                  </div>
                  {subtitle && (
                    <p className="task-list-subtitle">{subtitle}</p>
                  )}
                  <p className="task-list-meta">
                    {a.tutorialSteps?.length || 0} explained steps · Updated{' '}
                    {formatTimestamp(a.updatedAt)}
                  </p>
                </div>
                <div className="task-list-actions">
                  {canClaim && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleClaim(a._id)}
                      disabled={claiming === a._id}
                    >
                      {claiming === a._id ? 'Starting...' : 'Start tutorial'}
                    </button>
                  )}
                  {canOpen && (
                    <Link to={`/label/${a._id}`} className="btn btn-primary btn-sm">
                      Continue tutorial
                    </Link>
                  )}
                  {a.tutorialCompleted && (
                    <Link to={`/label/${a._id}`} className="btn btn-secondary btn-sm">
                      Review again
                    </Link>
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
