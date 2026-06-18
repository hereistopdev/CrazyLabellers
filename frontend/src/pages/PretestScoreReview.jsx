import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { FPS } from '../config/frameOffsets';
import FrameMagnifier from '../components/FrameMagnifier';
import ReviewTimeline from '../components/ReviewTimeline';
import { resolvePlaybackDuration } from '../utils/videoDuration';
import { displayAssignmentTitle } from '../utils/displayTitle';

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2);
  return `${m}:${s.padStart(5, '0')}`;
}

function scoreLabel(score, frameDiff) {
  if (score <= 0) return '0 (missed/wrong)';
  if (frameDiff == null || frameDiff <= 0) return '100 (exact frame)';
  return `${score} (${frameDiff} frame${frameDiff === 1 ? '' : 's'} off)`;
}

export default function PretestScoreReview() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const videoRef = useRef(null);

  const [reviewData, setReviewData] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playMode, setPlayMode] = useState('paused');
  const [magnifyEnabled, setMagnifyEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(false);
  const [error, setError] = useState('');
  const [mediaDuration, setMediaDuration] = useState(null);

  const assignment = reviewData?.assignment;
  const submission = reviewData?.submission;
  const reference = reviewData?.reference;
  const comparison = reviewData?.comparison;
  const breakdown = reviewData?.autoScoreBreakdown || [];
  const autoScore = reviewData?.autoScore;
  const passThreshold = reviewData?.passThreshold ?? 80;
  const passed = autoScore != null && autoScore >= passThreshold;

  const fps = assignment?.fps || FPS;
  const frameDuration = 1 / fps;
  const maxTime = resolvePlaybackDuration(mediaDuration, assignment?.durationSeconds);
  const isPaused = playMode === 'paused';

  useEffect(() => {
    setLoading(true);
    api
      .getPretestScoreReview(assignmentId)
      .then(setReviewData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [assignmentId]);

  const handleScrub = useCallback(
    (time) => {
      const clamped = Math.max(0, Math.min(maxTime, time));
      if (videoRef.current) {
        videoRef.current.currentTime = clamped;
      }
      setCurrentTime(clamped);
      setPlayMode('paused');
    },
    [maxTime]
  );

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playMode === 'normal') {
      video.pause();
      setPlayMode('paused');
    } else {
      video.play();
      setPlayMode('normal');
    }
  }, [playMode]);

  const stepFrames = useCallback(
    (delta) => {
      handleScrub(currentTime + delta * frameDuration);
    },
    [currentTime, frameDuration, handleScrub]
  );

  const finishReview = async () => {
    setAcknowledging(true);
    setError('');
    try {
      await api.acknowledgePretestScoreReview(assignmentId);
      const profile = await refreshUser();
      const canProduction =
        profile?.labelingTestPassed || (profile?.bestLabelingTestScore ?? 0) >= passThreshold;
      navigate(canProduction ? '/assignments' : '/labeling-test', {
        replace: true,
        state: {
          message: canProduction
            ? 'Pre-test complete! Real labeling tasks are unlocked.'
            : 'Review saved. Open your next pre-test clip when ready.',
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setAcknowledging(false);
    }
  };

  const canAccessProduction =
    user?.labelingTestPassed || (user?.bestLabelingTestScore ?? 0) >= passThreshold;

  const eventRows = useMemo(
    () =>
      (reviewData?.eventRows || []).map((row) => ({
        ...row,
        validation: { ...row.validation, status: 'pending' },
      })),
    [reviewData?.eventRows]
  );

  if (loading) return <div className="loading">Loading score review...</div>;

  if (error && !reviewData) {
    return (
      <div>
        <div className="alert alert-error">{error}</div>
        <Link to="/labeling-test" className="btn btn-secondary btn-sm">
          Back to pre-test
        </Link>
      </div>
    );
  }

  return (
    <div className="labeling-page review-page pretest-score-review">
      <div className="page-header">
        <h1>{displayAssignmentTitle({ ...assignment, kind: 'pretest' })}</h1>
        <p>
          <strong>One-time score review</strong> — compare your submission to the reference annotations.
          Reference data will not be shown again after you continue.
        </p>
        <div className={`labeling-score-total${passed ? ' passed' : ''}`} style={{ marginTop: '0.75rem' }}>
          <span className="labeling-score-value">{autoScore ?? '—'}</span>
          <span className="labeling-score-max">/ 100</span>
          <span style={{ marginLeft: 12, fontSize: '0.9rem' }}>
            {passed ? 'Passed' : `Need ${passThreshold}+ to pass pre-test`}
          </span>
        </div>
        {reference?.hasReference && comparison?.summary && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Reference: {reference.annotationCount} events · Matched {comparison.summary.matchedCount} ·
            Missing {comparison.summary.missingCount} · Extra {comparison.summary.extraCount}
          </p>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="review-workspace">
        <div className="video-panel review-video-panel">
          <FrameMagnifier
            videoRef={videoRef}
            currentTime={currentTime}
            isPaused={isPaused}
            enabled={magnifyEnabled}
            onEnabledChange={setMagnifyEnabled}
            submissionEvents={submission?.events || []}
            referenceEvents={reference?.hasReference ? reference.events : []}
            fps={fps}
          >
            <video
              ref={videoRef}
              src={assignment?.videoUrl}
              crossOrigin="anonymous"
              preload="auto"
              onLoadedMetadata={() => {
                const duration = videoRef.current?.duration;
                if (Number.isFinite(duration) && duration > 0) setMediaDuration(duration);
              }}
              onTimeUpdate={() => {
                if (videoRef.current && playMode === 'normal') {
                  setCurrentTime(videoRef.current.currentTime);
                }
              }}
              onPause={() => {
                if (playMode === 'normal') setPlayMode('paused');
              }}
            />
          </FrameMagnifier>

          <div className="video-controls">
            <div className="video-controls-row">
              <span className="time-display">{formatTime(currentTime)}</span>
              <input
                type="range"
                className="frame-slider"
                min={0}
                max={maxTime}
                step={frameDuration}
                value={currentTime}
                onChange={(e) => handleScrub(parseFloat(e.target.value))}
              />
            </div>
            <div className="video-controls-row playback-controls">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => stepFrames(-1)}>
                −1 frame
              </button>
              <button
                type="button"
                className={`btn btn-sm${playMode === 'normal' ? ' btn-primary' : ' btn-secondary'}`}
                onClick={togglePlayPause}
              >
                {playMode === 'normal' ? 'Pause' : 'Play'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => stepFrames(1)}>
                +1 frame
              </button>
            </div>
          </div>

          <ReviewTimeline
            currentTime={currentTime}
            maxTime={maxTime}
            fps={fps}
            submissionEvents={submission?.events || []}
            referenceEvents={reference?.hasReference ? reference.events : []}
            eventRows={eventRows}
            labellerName="Your labels"
            hasReference={reference?.hasReference}
            previewMode
            onSeek={handleScrub}
          />
        </div>

        <aside className="card pretest-score-sidebar">
          <h3>Score breakdown</h3>
          <p className="detail-muted" style={{ marginBottom: '0.75rem' }}>
            Each reference event counts equally. Timing: 100, 95, 90, 85… (−5 per frame off).
          </p>

          {breakdown.length > 0 ? (
            <div className="labeling-score-breakdown">
              {breakdown.map((item) => (
                <div key={`${item.eventType}-${item.referenceIndex}`} className="labeling-score-row">
                  <span className="type">{item.eventType}</span>
                  <span className="meta">
                    {item.status === 'missing' ? 'missing' : scoreLabel(item.score, item.frameDiff)}
                  </span>
                  <strong>{item.score}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="detail-muted">No breakdown available.</p>
          )}

          {reviewData?.missingReferenceEvents?.length > 0 && (
            <>
              <h4 style={{ marginTop: '1.25rem' }}>Missing from your submission</h4>
              <ul className="detail-list">
                {reviewData.missingReferenceEvents.map((ev) => (
                  <li key={`${ev.eventType}-${ev.frameTime}`}>
                    {ev.eventType} @ {formatTime(ev.frameTime)}
                  </li>
                ))}
              </ul>
            </>
          )}

          {reviewData?.extraSubmissionEvents?.length > 0 && (
            <>
              <h4 style={{ marginTop: '1rem' }}>Extra in your submission</h4>
              <ul className="detail-list">
                {reviewData.extraSubmissionEvents.map((ev) => (
                  <li key={`${ev.eventType}-${ev.frameTime}`}>
                    {ev.eventType} @ {formatTime(ev.frameTime)}
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="actions-row" style={{ marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={finishReview}
              disabled={acknowledging}
            >
              {acknowledging
                ? 'Saving…'
                : canAccessProduction
                  ? 'Continue to real tasks'
                  : 'Try another pre-test clip'}
            </button>
          </div>
          <p className="detail-muted" style={{ marginTop: '0.65rem', fontSize: '0.82rem' }}>
            Continuing closes this review permanently for this clip.
          </p>
        </aside>
      </div>
    </div>
  );
}
