import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatTimestamp } from '../utils/formatTimestamp';
import { formatMoney } from '../utils/money';
import { displayAssignmentTitle, assignmentSubtitle } from '../utils/displayTitle';
import { labelerPath } from '../utils/labelerAccess';

export default function Tutorials() {
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  if (loading) return <div className="loading">Loading tutorials...</div>;

  if (status && !status.canAccess) {
    return (
      <div>
        <div className="page-header">
          <h1>Labeling tutorials</h1>
        </div>
        <div className="alert alert-info">
          Pass the knowledge test (80%+) first, then return here for guided tutorials.
        </div>
        <Link to="/test" className="btn btn-primary btn-sm">
          Take knowledge test
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Labeling tutorials</h1>
        <p>
          Open any tutorial clip — no claim needed. Read the frame explanations, then mark complete
          when finished. Tutorials are free ({formatMoney(0)}). Complete all to unlock the 3-clip pre-test.
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
          Watch each clip and follow the explanations. No labeling submission is required for
          tutorials.
        </div>
      )}

      {assignments.filter((a) => a.kind === 'tutorial').length === 0 ? (
        <div className="empty-state">No tutorial clips configured yet. Ask an admin to mark videos as Tutorial.</div>
      ) : (
        <div className="task-list">
          {assignments
            .filter((a) => a.kind === 'tutorial')
            .map((a, index) => {
            const subtitle = assignmentSubtitle(a);
            const stepCount = a.tutorialSteps?.length || 0;

            return (
              <div key={a._id} className="task-list-item card">
                <div className="task-list-body">
                  <div className="task-list-title-row">
                    <h3>{displayAssignmentTitle(a, index)}</h3>
                    {a.tutorialCompleted && (
                      <span className="status-badge status-approved">Completed</span>
                    )}
                  </div>
                  {subtitle && <p className="task-list-subtitle">{subtitle}</p>}
                  <p className="task-list-meta">
                    {stepCount} explained step{stepCount === 1 ? '' : 's'}
                    {stepCount === 0 && ' (admin still adding explanations)'}
                    {' · '}
                    Updated {formatTimestamp(a.updatedAt)}
                  </p>
                </div>
                <div className="task-list-actions">
                  <Link to={labelerPath(String(a._id))} className="btn btn-primary btn-sm">
                    {a.tutorialCompleted ? 'Review again' : 'Open tutorial'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
