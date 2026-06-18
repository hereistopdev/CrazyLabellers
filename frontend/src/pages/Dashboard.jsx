import { useAuth } from '../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import { isValidator } from '../utils/roles';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useAuth();

  if (user?.role === 'admin') {
    return <AdminDashboard />;
  }

  if (isValidator(user)) {
    return (
      <div>
        <div className="page-header">
          <h1>Hello, {user?.name}</h1>
          <p>Review submitted labeller tasks, compare against reference annotations, and assign scores.</p>
        </div>
        <Link to="/review" className="btn btn-primary">
          Open review queue
        </Link>
      </div>
    );
  }

  const onboarding = user?.onboarding;
  const passedKnowledge =
    onboarding?.steps?.knowledge?.passed ??
    (user?.bestTestScore >= 80 || user?.status === 'passed_test' || user?.status === 'approved');
  const tutorialsDone =
    onboarding?.steps?.tutorials?.passed ?? Boolean(user?.tutorialsCompleted);
  const canPretest =
    onboarding?.canAccessPretest ?? (passedKnowledge && tutorialsDone);
  const passedLabeling =
    onboarding?.steps?.labelingTest?.passed ??
    (user?.labelingTestPassed || (user?.bestLabelingTestScore ?? 0) >= 80 || user?.status === 'approved');
  const canProduction = onboarding?.canAccessProduction ?? (canPretest && passedLabeling);

  return (
    <div>
      <div className="page-header">
        <h1>Hello, {user?.name}</h1>
        <p>
          Knowledge test → tutorials → video pre-test → real tasks. After tutorials you get{' '}
          <strong>3 random clips</strong> from the admin pre-test pool to label and score.
        </p>
      </div>

      {!passedKnowledge && (
        <div className="alert alert-info">
          Complete the terminology guide and pass the knowledge test (80%+) first.
        </div>
      )}

      {passedKnowledge && !tutorialsDone && (
        <div className="alert alert-info">
          Knowledge test passed. Complete all labeling tutorials (with frame explanations) to unlock
          the pre-test.
        </div>
      )}

      {canPretest && !passedLabeling && (
        <div className="alert alert-info">
          Tutorials complete. You will receive 3 random pre-test clips from the pool. Score at least
          80/100 to unlock real tasks.
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
          <h3>Labeling Tutorials</h3>
          <p>
            Open any tutorial clip (no claim needed). Follow the frame explanations, then mark each
            one complete — no labeling submission required.
          </p>
          <div className="actions-row">
            {passedKnowledge ? (
              <Link to="/tutorials" className="btn btn-primary btn-sm">
                {tutorialsDone ? 'Review tutorials' : 'Start tutorials'}
              </Link>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" disabled>
                Locked — pass knowledge test first
              </button>
            )}
          </div>
          {passedKnowledge && (
            <p style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {tutorialsDone ? 'All tutorials completed' : 'Required before pre-test'}
            </p>
          )}
        </div>

        <div className="step-card">
          <div className="step-number">4</div>
          <h3>Labeling Pre-test</h3>
          <p>
            Label your assigned practice clips (3 random picks from the admin pool). Auto score out
            of 100 — 80+ required to unlock real tasks.
          </p>
          <div className="actions-row">
            {canPretest ? (
              <Link to="/labeling-test" className="btn btn-primary btn-sm">
                {passedLabeling ? 'Review pre-test' : 'Take labeling test'}
              </Link>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" disabled>
                {passedKnowledge ? 'Locked — complete tutorials first' : 'Locked — pass knowledge test first'}
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
          <div className="step-number">5</div>
          <h3>Real Labeling Tasks</h3>
          <p>Production clips grouped by match after both tests are passed.</p>
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
          <div className="step-number">6</div>
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
