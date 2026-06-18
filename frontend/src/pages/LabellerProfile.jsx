import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import { formatMoney } from '../utils/money';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function LabellerProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    const load = id ? api.getLabellerProfile(id) : api.getMyProfile();
    load
      .then(setProfile)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading">Loading profile...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!profile) return null;

  const { labeller, reviews, workHistory } = profile;
  const isOwnProfile = !id || id === user?.id;

  return (
    <div className="labeller-profile-page">
      <div className="page-header">
        <h1>{isOwnProfile ? 'My work profile' : `${labeller.name}'s profile`}</h1>
        <p>Work history and client reviews — similar to a freelancer marketplace profile.</p>
      </div>

      <div className="profile-hero card">
        <div className="profile-hero-main">
          <div className="profile-avatar">{labeller.name?.charAt(0)?.toUpperCase() || '?'}</div>
          <div>
            <h2>{labeller.name}</h2>
            <p className="profile-email">{labeller.email}</p>
            <p className="profile-meta">
              Member since {formatDate(labeller.memberSince)} ·{' '}
              <span className={`status-badge status-${labeller.status}`}>
                {labeller.status?.replace('_', ' ')}
              </span>
            </p>
          </div>
        </div>

        <div className="profile-stats-row">
          <div className="profile-stat">
            <StarRating value={Math.round(labeller.avgRating || 0)} readOnly size="sm" />
            <strong>{labeller.avgRating || '—'}</strong>
            <span>{labeller.reviewCount} review{labeller.reviewCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="profile-stat">
            <strong>{labeller.jobsCompleted}</strong>
            <span>Jobs completed</span>
          </div>
          <div className="profile-stat">
            <strong>{labeller.bestLabelingTestScore || 0}/100</strong>
            <span>Best labeling test</span>
          </div>
          <div className="profile-stat">
            <strong>{labeller.bestTestScore || 0}%</strong>
            <span>Knowledge test</span>
          </div>
        </div>

        {labeller.aspectAverages && (
          <div className="profile-aspects">
            <span>Quality {labeller.aspectAverages.quality}/5</span>
            <span>Accuracy {labeller.aspectAverages.accuracy}/5</span>
            <span>Timeliness {labeller.aspectAverages.timeliness}/5</span>
          </div>
        )}
      </div>

      <div className="profile-grid">
        <section className="card profile-section">
          <h3>Client reviews</h3>
          {reviews.length === 0 ? (
            <p className="profile-empty">No reviews yet. Reviews are left when a validator approves work.</p>
          ) : (
            <ul className="profile-review-list">
              {reviews.map((review) => (
                <li key={review._id} className="profile-review-item">
                  <div className="profile-review-header">
                    <StarRating value={review.rating} readOnly size="sm" />
                    <strong>{review.assignmentTitle || 'Labeling task'}</strong>
                    <span className="profile-review-date">{formatDate(review.createdAt)}</span>
                  </div>
                  <p className="profile-review-by">
                    by {review.reviewerName}
                    {review.reviewPoints != null && ` · ${review.reviewPoints} pts`}
                    {review.earnings > 0 && ` · ${formatMoney(review.earnings)}`}
                  </p>
                  {review.comment && <p className="profile-review-comment">{review.comment}</p>}
                  {review.aspects && (
                    <p className="profile-review-aspects">
                      Quality {review.aspects.quality}/5 · Accuracy {review.aspects.accuracy}/5 ·
                      Timeliness {review.aspects.timeliness}/5
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card profile-section">
          <h3>Work history</h3>
          {workHistory.length === 0 ? (
            <p className="profile-empty">No submitted tasks yet.</p>
          ) : (
            <ul className="profile-work-list">
              {workHistory.map((task) => (
                <li key={task.id} className={`profile-work-item profile-work-${task.status}`}>
                  <div className="profile-work-title">{task.title}</div>
                  <div className="profile-work-meta">
                    <span className={`status-badge status-${task.status === 'submitted' ? 'passed_test' : task.status}`}>
                      {task.status === 'submitted' ? 'pending review' : task.status}
                    </span>
                    {task.taskPrice != null && <span>Pays up to {formatMoney(task.taskPrice)}</span>}
                    {task.reviewPoints != null && <span>{task.reviewPoints} pts</span>}
                    {task.earnings > 0 && <span>{formatMoney(task.earnings)} earned</span>}
                    {task.rating != null && (
                      <span className="profile-work-rating">
                        <StarRating value={task.rating} readOnly size="sm" />
                      </span>
                    )}
                  </div>
                  {task.reviewComment && <p className="profile-work-comment">{task.reviewComment}</p>}
                  {task.challengeNote && (
                    <p className="profile-work-challenge">Challenge: {task.challengeNote}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {!isOwnProfile && (
        <div className="actions-row" style={{ marginTop: '1rem' }}>
          <Link to={`/admin/labellers`} className="btn btn-secondary btn-sm">
            Back to labellers
          </Link>
        </div>
      )}
    </div>
  );
}
