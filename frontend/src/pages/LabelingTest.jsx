import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatTimestamp } from '../utils/formatTimestamp';
import { displayAssignmentTitle, assignmentSubtitle } from '../utils/displayTitle';
import { labelerPath } from '../utils/labelerAccess';

function progressLabel(assignment) {
  const progress = assignment.userProgress || 'open';
  if (progress === 'submitted') {
    return assignment.scoreReviewAvailable ? 'Review pending' : 'Completed';
  }
  if (progress === 'in_progress') return 'In progress';
  return 'Not started';
}

export default function LabelingTest() {
  const { refreshUser } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  if (loading) return <div className="loading">Loading labeling test...</div>;

  const passed = status?.passed;
  const canProduction = status?.canAccessProduction;
  const tutorialsDone = status?.tutorialsCompleted;
  const canAccess = status?.canAccessPretest;
  const bannerMessage = location.state?.message;

  return (
    <div>
      <div className="page-header">
        <h1>Labeling pre-test</h1>
        <p>
          You receive <strong>3 random clips</strong> from the admin pre-test pool. Open any of your
          clips directly — no claim needed. Each submission is scored automatically. After submit,
          you get a <strong>one-time</strong> score review with reference data, then move on to your
          other clips. Score <strong>80/100 or higher on all 3 clips</strong> to unlock real labeling
          tasks.
        </p>
      </div>

      {bannerMessage && <div className="alert alert-info">{bannerMessage}</div>}
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
          <div className="value">
            {status?.clipsPassed ?? 0}/{status?.clipsRequired ?? status?.pretestCount ?? 3}
          </div>
          <div className="label">Clips passed</div>
        </div>
        <div className="stat-card">
          <div className="value">
            {status?.clipsAssigned ?? 0}/{status?.pretestCount ?? 3}
          </div>
          <div className="label">Your pre-test clips</div>
        </div>
        {status?.pretestPool?.total > 0 && (
          <div className="stat-card">
            <div className="value">{status.pretestPool.total}</div>
            <div className="label">Clips in pool</div>
          </div>
        )}
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
          You passed all {status?.clipsRequired ?? 3} pre-test clips!{' '}
          {canProduction ? (
            <Link to="/assignments">Open real labeling tasks</Link>
          ) : (
            'Real tasks will unlock shortly.'
          )}
        </div>
      ) : (
        canAccess && (
          <div className="alert alert-info">
            Pass each clip with {status?.passThreshold ?? 80}/100 or higher. Progress:{' '}
            <strong>
              {status?.clipsPassed ?? 0}/{status?.clipsRequired ?? 3} clips passed
            </strong>
            . Each reference event is worth an equal share of 100 points. Frame accuracy per event:
            0 frames off = 100, 1 = 95, 2 = 90, 3 = 85, and so on (−5 per frame). Missing or
            wrong events score 0.
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
            const progress = a.userProgress || 'open';
            const subtitle = assignmentSubtitle(a);
            const reviewPending = progress === 'submitted' && a.scoreReviewAvailable;

            return (
              <div key={a._id} className="task-list-item card">
                <div className="task-list-body">
                  <h3>{displayAssignmentTitle({ ...a, kind: 'pretest' }, index)}</h3>
                  {subtitle && <p className="task-list-subtitle">{subtitle}</p>}
                  <p className="task-list-meta">
                    Duration: {a.durationSeconds || 30}s ·{' '}
                    <span className="status-badge status-passed_test">Pre-test · Free</span>
                    {' · '}
                    {progressLabel(a)}
                    {a.lastScore != null && (
                      <>
                        {' · '}
                        Last score: <strong>{a.lastScore}/100</strong>
                        {a.clipPassed != null && (
                          <>
                            {' '}
                            ({a.clipPassed ? 'passed' : 'not passed'})
                          </>
                        )}
                      </>
                    )}
                    {' · '}
                    Updated {formatTimestamp(a.updatedAt)}
                  </p>
                </div>
                <div className="task-list-actions">
                  {reviewPending ? (
                    <Link
                      to={`/labeling-test/${a._id}/review`}
                      className="btn btn-primary btn-sm"
                    >
                      View score review
                    </Link>
                  ) : progress === 'submitted' ? (
                    <span className="detail-muted" style={{ fontSize: '0.85rem' }}>
                      Review viewed
                    </span>
                  ) : (
                    <Link to={labelerPath(String(a._id))} className="btn btn-primary btn-sm">
                      {progress === 'in_progress' ? 'Continue labeling' : 'Start clip'}
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
