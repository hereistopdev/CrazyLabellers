import { useAuth } from '../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import { isChecker } from '../utils/roles';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useAuth();

  if (user?.role === 'admin') {
    return <AdminDashboard />;
  }

  if (isChecker(user)) {
    return (
      <div>
        <div className="page-header">
          <h1>Hello, {user?.name}</h1>
          <p>Review labeller submissions with video playback and reference comparison.</p>
        </div>
        <Link to="/review" className="btn btn-primary">
          Open review queue
        </Link>
      </div>
    );
  }

  const passedKnowledge = user?.bestTestScore >= 80;
  const canPretest = user?.status === 'passed_test' || user?.status === 'approved';
  const passedLabeling =
    user?.labelingTestPassed || (user?.bestLabelingTestScore ?? 0) >= 80 || user?.status === 'approved';
  const canProduction = canPretest && passedLabeling;

  return (
    <div>
      <div className="page-header">
        <h1>Hello, {user?.name}</h1>
        <p>
          Learn terminology, pass the knowledge test, complete a labeling pre-test scored against
          reference clips, then unlock real labeling tasks.
        </p>
      </div>

      {!passedKnowledge && (
        <div className="alert alert-info">
          Complete the terminology guide and pass the knowledge test (80%+) first.
        </div>
      )}

      {passedKnowledge && !passedLabeling && (
        <div className="alert alert-info">
          Knowledge test passed. Complete the labeling pre-test and score at least 80/100 to unlock
          real tasks.
        </div>
      )}

      {canProduction && (
        <div className="alert alert-success">
          You are qualified for production labeling tasks.
        </div>
      )}

      <div className="step-cards">
        <div className="step-card">
          <div className="step-number">1</div>
          <h3>Study Terminology</h3>
          <p>Read definitions and flow diagrams for all event types.</p>
          <div className="actions-row">
            <Link to="/terminology" className="btn btn-secondary btn-sm">
              Open guide
            </Link>
          </div>
        </div>

        <div className="step-card">
          <div className="step-number">2</div>
          <h3>Knowledge Test</h3>
          <p>Scenario questions — need 80% or higher to pass.</p>
          <div className="actions-row">
            <Link to="/test" className="btn btn-primary btn-sm">
              {passedKnowledge ? 'Retake test' : 'Take test'}
            </Link>
          </div>
          {user?.bestTestScore > 0 && (
            <p style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Best score: {user.bestTestScore}%
            </p>
          )}
        </div>

        <div className="step-card">
          <div className="step-number">3</div>
          <h3>Labeling Pre-test</h3>
          <p>
            Label reference clips. Auto score out of 100 — 80+ required. Each reference event
            counts equally; frame accuracy gives 100, 90, 80… per event.
          </p>
          <div className="actions-row">
            {canPretest ? (
              <Link to="/labeling-test" className="btn btn-primary btn-sm">
                {passedLabeling ? 'Review pre-test' : 'Take labeling test'}
              </Link>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" disabled>
                Locked — pass knowledge test first
              </button>
            )}
          </div>
          {(user?.bestLabelingTestScore ?? 0) > 0 && (
            <p style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Best score: {user.bestLabelingTestScore}/100
            </p>
          )}
        </div>

        <div className="step-card">
          <div className="step-number">4</div>
          <h3>Real Labeling Tasks</h3>
          <p>Production clips after both tests are passed.</p>
          <div className="actions-row">
            {canProduction ? (
              <Link to="/assignments" className="btn btn-primary btn-sm">
                View assignments
              </Link>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" disabled>
                Locked — pass pre-test (80/100+)
              </button>
            )}
          </div>
        </div>

        <div className="step-card">
          <div className="step-number">5</div>
          <h3>My Earnings</h3>
          <p>Track review points and payment earned for approved tasks.</p>
          <div className="actions-row">
            <Link to="/earnings" className="btn btn-secondary btn-sm">
              View earnings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
