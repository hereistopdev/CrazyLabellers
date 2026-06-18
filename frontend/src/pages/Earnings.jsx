import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { formatMoney } from '../utils/money';
import StarRating from '../components/StarRating';
import PaymentAddressesForm from '../components/PaymentAddressesSection';

export default function Earnings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getMyEarnings()
      .then(setData)
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
          You earn based on task price and review quality. Each task pays up to its set price at 100
          review points.
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
          <div className="value">{data.summary.totalPoints}</div>
          <div className="label">Total review points</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.summary.avgPoints}</div>
          <div className="label">Average points / task</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.summary.tasksCompleted}</div>
          <div className="label">Tasks approved</div>
        </div>
      </div>

      {data.summary.pendingReview > 0 && (
        <div className="alert alert-info">
          {data.summary.pendingReview} task(s) submitted and awaiting admin review.
        </div>
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
