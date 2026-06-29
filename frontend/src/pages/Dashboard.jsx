import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import { isValidator, isVideoManager, canAccessReview, canAccessVideoManagement } from '../utils/roles';
import { api } from '../api';
import LabellerBadges from '../components/LabellerBadges';
import { formatMoney } from '../utils/money';

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const [badgeData, setBadgeData] = useState(null);

  useEffect(() => {
    if (isVideoManager(user) || isValidator(user)) {
      refreshUser().catch(() => {});
    }
  }, [user?.role, user?.status, refreshUser]);

  useEffect(() => {
    if (user?.role === 'labeller' || user?.role === 'freelancer') {
      api.getMyBadges().then(setBadgeData).catch(() => {});
    }
  }, [user?.role]);

  if (user?.role === 'admin') {
    return <AdminDashboard />;
  }

  if (isValidator(user)) {
    const approved = canAccessReview(user);

    return (
      <div>
        <div className="page-header">
          <h1>Hello, {user?.name}</h1>
          {approved ? (
            <p>
              Review submitted labeller tasks, compare against reference annotations, and assign
              scores.
            </p>
          ) : user?.status === 'rejected' ? (
            <p>Your validator application was not approved. Contact an admin if you believe this is a mistake.</p>
          ) : (
            <p>
              Your validator account is waiting for admin approval. You will be able to open the
              review queue once an admin approves your account.
            </p>
          )}
        </div>

        {!approved && user?.status !== 'rejected' && (
          <div className="alert alert-info">
            Pending approval — an admin must approve your account before you can review tasks.
          </div>
        )}

        {user?.status === 'rejected' && (
          <div className="alert alert-error">Access denied — validator account not approved.</div>
        )}

        {approved && (
          <Link to="/review" className="btn btn-primary">
            Open review queue
          </Link>
        )}
      </div>
    );
  }

  if (isVideoManager(user)) {
    const approved = canAccessVideoManagement(user);

    return (
      <div>
        <div className="page-header">
          <h1>Hello, {user?.name}</h1>
          {approved ? (
            <p>Upload football video clips and reference JSON files for the labeling platform.</p>
          ) : user?.status === 'rejected' ? (
            <p>
              Your manager application was not approved. Contact an admin if you believe this is a
              mistake.
            </p>
          ) : (
            <p>
              Your manager account is waiting for admin approval. You will be able to upload videos
              once an admin approves your account.
            </p>
          )}
        </div>

        {!approved && user?.status !== 'rejected' && (
          <div className="alert alert-info">
            Pending approval — an admin must approve your account before you can manage videos.
          </div>
        )}

        {user?.status === 'rejected' && (
          <div className="alert alert-error">Access denied — manager account not approved.</div>
        )}

        {approved && (
          <div className="actions-row">
            <Link to="/admin/videos" className="btn btn-primary">
              Manage videos
            </Link>
            <Link to="/admin/tasks" className="btn btn-secondary">
              Tasks & groups
            </Link>
          </div>
        )}
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
    (user?.labelingTestPassed || user?.status === 'approved');
  const canProduction = onboarding?.canAccessProduction ?? (canPretest && passedLabeling);
  const clipsPassed = onboarding?.steps?.labelingTest?.clipsPassed;
  const clipsRequired = onboarding?.steps?.labelingTest?.clipsRequired ?? 3;

  return (
    <div>
      <div className="page-header">
        <h1>Hello, {user?.name}</h1>
        <p>
          Knowledge test → tutorials → video pre-test → real tasks. After tutorials you get{' '}
          <strong>3 random clips</strong> from the admin pre-test pool — pass{' '}
          <strong>3 clips in total</strong> with 80/100+ to unlock production work. Failed clips
          are replaced with new ones.
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
          Tutorials complete. You will receive 3 random pre-test clips from the pool. Pass{' '}
          <strong>3 clips in total</strong> with at least 80/100 each to unlock real tasks
          {clipsPassed != null ? (
            <>
              {' '}
              (progress: {clipsPassed}/{clipsRequired} passed).
            </>
          ) : (
            '. Failed clips are swapped for new ones after score review.'
          )}
        </div>
      )}

      {canProduction && (
        <div className="alert alert-success">
          You are qualified for production labeling tasks.
        </div>
      )}

      {badgeData && (
        <section className="card labeller-badges-panel">
          <h3>Work badges</h3>
          <LabellerBadges
            badges={badgeData.badges}
            jobsCompleted={badgeData.jobsCompleted}
            compact
            showLocked
          />
          {badgeData.nextBadge && (
            <p className="labeller-badges-footnote" style={{ marginTop: '0.85rem' }}>
              Next up: {badgeData.nextBadge.icon} <strong>{badgeData.nextBadge.title}</strong> at{' '}
              {badgeData.nextBadge.clipThreshold} clips ({badgeData.nextBadge.remaining} to go).
            </p>
          )}
        </section>
      )}

      <div className="step-cards">
        <div className="step-card">
          <div className="step-number">1</div>
          <h3>Study Terminology</h3>
          <p>Read definitions and flow diagrams for all event types.</p>
          <div className="actions-row">
            <Link to="/terminology" className="btn btn-secondary btn-sm">
              Terminology
            </Link>
            <Link to="/labeling-guide" className="btn btn-secondary btn-sm">
              Labeling rules
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
            Label practice clips from the admin pool (3 at a time). Pass{' '}
            <strong>3 clips in total</strong> with 80/100+ to unlock real tasks. Failed clips are
            replaced with new ones after score review.
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
