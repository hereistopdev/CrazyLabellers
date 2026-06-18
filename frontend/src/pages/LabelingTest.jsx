import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatTimestamp } from '../utils/formatTimestamp';
import { displayAssignmentTitle, assignmentSubtitle } from '../utils/displayTitle';

const STATUS_LABELS = {
  available: 'Available',
  assigned: 'Assigned',
  in_progress: 'In progress',
  submitted: 'Submitted',
};

export default function LabelingTest() {
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.getLabelingTestStatus(), api.getLabelingTestAssignments()])
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

  if (loading) return <div className="loading">Loading labeling test...</div>;

  const passed = status?.passed;
  const canProduction = status?.canAccessProduction;
  const tutorialsDone = status?.tutorialsCompleted;
  const canAccess = status?.canAccessPretest;

  return (
    <div>
      <div className="page-header">
        <h1>Labeling pre-test</h1>
        <p>
          Label <strong>3 practice clips</strong> (free — no payment). Each submission is scored
          automatically against reference annotations. Score <strong>80/100 or higher</strong> to
          unlock real labeling tasks.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {!tutorialsDone && (
        <div className="alert alert-info">
          Complete all labeling tutorials first.{' '}
          <Link to="/tutorials">Go to tutorials</Link>
        </div>
      )}

      <div className="stat-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="stat-card">
          <div className="value">{status?.bestScore ?? 0}</div>
          <div className="label">Best score / 100</div>
        </div>
        <div className="stat-card">
          <div className="value">{status?.pretestCount ?? 3}</div>
          <div className="label">Pre-test clips</div>
        </div>
        <div className="stat-card">
          <div className="value">{status?.attempts ?? 0}</div>
          <div className="label">Attempts</div>
        </div>
        <div className="stat-card">
          <div className="value">{passed ? 'Passed' : 'Not passed'}</div>
          <div className="label">Pre-test status</div>
        </div>
      </div>

      {passed ? (
        <div className="alert alert-success">
          You passed the labeling pre-test!{' '}
          {canProduction ? (
            <Link to="/assignments">Open real labeling tasks</Link>
          ) : (
            'Real tasks will unlock shortly.'
          )}
        </div>
      ) : (
        canAccess && (
          <div className="alert alert-info">
            Each reference event is worth an equal share of 100 points. Frame accuracy per event:
            0 frames = 100, 1 = 90, 2 = 80, and so on. Missing or wrong events score 0.
          </div>
        )
      )}

      {status?.latestResult && (
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.35rem' }}>Latest attempt</h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            {status.latestResult.assignmentId?.title} — score{' '}
            <strong>{status.latestResult.score}/100</strong>
            {status.latestResult.passed ? ' (passed)' : ' (not passed)'}
            {' · '}
            {formatTimestamp(status.latestResult.createdAt)}
          </p>
        </div>
      )}

      {!canAccess ? (
        <div className="empty-state">
          {tutorialsDone
            ? 'Pass the knowledge test (80%+) to access pre-test clips.'
            : 'Complete tutorials to unlock pre-test clips.'}
        </div>
      ) : assignments.length === 0 ? (
        <div className="empty-state">No labeling test clips available yet.</div>
      ) : (
        <div className="task-list">
          {assignments.map((a, index) => {
            const isMine =
              a.assignedTo?._id === user?.id || a.assignedTo === user?.id;
            const canOpen = isMine && ['assigned', 'in_progress'].includes(a.status);
            const canClaim = a.status === 'available';
            const subtitle = assignmentSubtitle(a);

            return (
              <div key={a._id} className="task-list-item card">
                <div className="task-list-body">
                  <h3>{displayAssignmentTitle({ ...a, kind: 'pretest' }, index)}</h3>
                  {subtitle && <p className="task-list-subtitle">{subtitle}</p>}
                  <p className="task-list-meta">
                    Duration: {a.durationSeconds || 30}s ·{' '}
                    <span className="status-badge status-passed_test">Pre-test · Free</span>
                    {' · '}
                    {STATUS_LABELS[a.status] || a.status}
                    {a.lastScore != null && (
                      <>
                        {' · '}
                        Last score: <strong>{a.lastScore}/100</strong>
                      </>
                    )}
                    {' · '}
                    Updated {formatTimestamp(a.updatedAt)}
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
                      {claiming === a._id ? 'Claiming...' : 'Start test clip'}
                    </button>
                  )}
                  {canOpen && (
                    <Link to={`/label/${a._id}`} className="btn btn-primary btn-sm">
                      Continue labeling
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
