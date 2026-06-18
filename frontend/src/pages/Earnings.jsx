import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { formatMoney } from '../utils/money';
import StarRating from '../components/StarRating';
import PaymentAddressesForm from '../components/PaymentAddressesSection';
import LabellerBadges from '../components/LabellerBadges';

function formatBadgeDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function Earnings() {
  const [data, setData] = useState(null);
  const [badgeData, setBadgeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.getMyEarnings(), api.getMyBadges()])
      .then(([earnings, badges]) => {
        setData(earnings);
        setBadgeData(badges);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading earnings...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  const currency = data?.settings?.currency || 'USD';

  return (
    <div>
      <div className="page-header">
        <h1>My Earnings</h1>
        <p>
          You earn from approved task review points plus one-time badge bonuses for work milestones.
        </p>
        <Link to="/profile" className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem' }}>
          View my work profile
        </Link>
      </div>

      <div className="stat-grid">
        <div className="stat-card highlight-earnings">
          <div className="value">{formatMoney(data.summary.totalEarnings, currency)}</div>
          <div className="label">Total earned</div>
        </div>
        <div className="stat-card">
          <div className="value">{formatMoney(data.summary.taskEarnings ?? 0, currency)}</div>
          <div className="label">From tasks</div>
        </div>
        <div className="stat-card">
          <div className="value">{formatMoney(data.summary.badgeEarnings ?? 0, currency)}</div>
          <div className="label">From badges</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.summary.totalPoints}</div>
          <div className="label">Total review points</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.summary.tasksCompleted}</div>
          <div className="label">Tasks approved</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.summary.badgesEarned ?? 0}</div>
          <div className="label">Badges earned</div>
        </div>
      </div>

      {data.summary.pendingReview > 0 && (
        <div className="alert alert-info">
          {data.summary.pendingReview} task(s) submitted and awaiting admin review.
        </div>
      )}

      {badgeData && (
        <section className="card labeller-badges-panel">
          <h3>Work badges</h3>
          <p className="labeller-badges-panel-intro">
            Each badge pays once when you reach the clip milestone. Bonus = $0.02 × milestone clips.
          </p>
          <LabellerBadges
            badges={badgeData.badges}
            jobsCompleted={badgeData.jobsCompleted}
            compact
            showLocked
          />
        </section>
      )}

      {data.badgeGrants?.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Badge bonuses</h2>
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
            <ul className="badge-grants-list">
              {data.badgeGrants.map((grant) => (
                <li key={grant.id} className="badge-grant-item">
                  <div className="badge-grant-main">
                    <span className="badge-grant-icon" aria-hidden="true">
                      {grant.icon}
                    </span>
                    <div>
                      <div className="badge-grant-title">{grant.title}</div>
                      <div className="badge-grant-meta">
                        {grant.clipThreshold} clips · {formatBadgeDate(grant.earnedAt)}
                      </div>
                    </div>
                  </div>
                  <div className="badge-grant-bonus">+{formatMoney(grant.bonusAmount, currency)}</div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <PaymentAddressesForm />
      </div>

      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Task history</h2>
      <div className="card">
        {data.tasks.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', padding: '1rem' }}>No submitted tasks yet</p>
        ) : (
          <ul className="finance-task-list" style={{ padding: '1rem' }}>
            {data.tasks.map((t) => (
              <li key={t.id} className={`finance-task finance-task-${t.status}`}>
                <div className="finance-task-title">{t.title || 'Labeling task'}</div>
                <div className="finance-task-meta">
                  <span className={`status-badge status-${t.status === 'submitted' ? 'passed_test' : t.status}`}>
                    {t.status === 'submitted' ? 'pending review' : t.status}
                  </span>
                  <span>{t.eventsCount} events</span>
                  {t.taskPrice != null && <span>Up to {formatMoney(t.taskPrice, currency)}</span>}
                  {t.reviewPoints != null && <span>{t.reviewPoints} review pts</span>}
                  {t.earnings > 0 && (
                    <span className="earnings-cell">{formatMoney(t.earnings, currency)}</span>
                  )}
                  {t.rating != null && (
                    <span>
                      <StarRating value={t.rating} readOnly size="sm" />
                    </span>
                  )}
                </div>
                {(t.reviewComment || t.reviewerNotes) && (
                  <p className="finance-task-notes">{t.reviewComment || t.reviewerNotes}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
