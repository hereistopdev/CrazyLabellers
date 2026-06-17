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

  const canLabel = user?.status === 'passed_test' || user?.status === 'approved';
  const passedTest = user?.bestTestScore >= 80;

  return (
    <div>
      <div className="page-header">
        <h1>Hello, {user?.name}</h1>
        <p>
          AI football narrator labeling platform. Learn the event definitions, pass the knowledge
          test, then label 30-second video clips with frame-accurate events.
        </p>
      </div>

      {!canLabel && (
        <div className="alert alert-info">
          Complete the terminology guide and pass the knowledge test (80%+) to unlock labeling
          assignments.
        </div>
      )}

      {canLabel && user?.status === 'passed_test' && (
        <div className="alert alert-success">
          You passed the knowledge test! An admin will review and approve your account. You can
          practice on sample clips in the meantime.
        </div>
      )}

      <div className="step-cards">
        <div className="step-card">
          <div className="step-number">1</div>
          <h3>Study Terminology</h3>
          <p>
            Read definitions and flow diagrams for all 16 event types — what comes before/after,
            and how to tell similar events apart.
          </p>
          <div className="actions-row">
            <Link to="/terminology" className="btn btn-secondary btn-sm">
              Open guide
            </Link>
          </div>
        </div>

        <div className="step-card">
          <div className="step-number">2</div>
          <h3>Knowledge Test</h3>
          <p>
            Answer scenario-based questions to prove you understand each event type. Need 80% to
            pass.
          </p>
          <div className="actions-row">
            <Link to="/test" className="btn btn-primary btn-sm">
              {passedTest ? 'Retake test' : 'Take test'}
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
          <h3>Label Videos</h3>
          <p>Watch 30-second clips and mark events at the exact frame they occur.</p>
          <div className="actions-row">
            {canLabel ? (
              <Link to="/assignments" className="btn btn-primary btn-sm">
                View assignments
              </Link>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" disabled>
                Locked — pass test first
              </button>
            )}
          </div>
        </div>

        <div className="step-card">
          <div className="step-number">4</div>
          <h3>My Earnings</h3>
          <p>Track review points and payment earned for each approved labeling task.</p>
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
