import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { FPS } from '../config/frameOffsets';
import FrameMagnifier from '../components/FrameMagnifier';
import ReviewTimeline from '../components/ReviewTimeline';
import { isEditableTarget } from '../config/labelingHotkeys';
import { formatMoney } from '../utils/money';
import {
  buildSortedEventFrames,
  findNextEventFrame,
  findPrevEventFrame,
  getFrameNumber,
  getTimeForFrame,
  isEventFrame,
} from '../utils/reviewPlayback';

const FRAME_PLAY_INTERVAL_MS = 500;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2);
  return `${m}:${s.padStart(5, '0')}`;
}

export default function ReviewSubmission() {
  const { submissionId } = useParams();
  const videoRef = useRef(null);
  const frameAutoTimerRef = useRef(null);
  const skippedEventFramesRef = useRef(new Set());
  const playModeRef = useRef('paused');
  const eventPlaybackModeRef = useRef('auto-pause');

  const [reviewData, setReviewData] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playMode, setPlayMode] = useState('paused');
  const [eventPlaybackMode, setEventPlaybackMode] = useState('auto-pause');
  const [pausedAtEvent, setPausedAtEvent] = useState(false);
  const [magnifyEnabled, setMagnifyEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reviewPoints, setReviewPoints] = useState(80);
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [ratePerPoint, setRatePerPoint] = useState(0.1);
  const [currency, setCurrency] = useState('USD');

  const assignment = reviewData?.assignment;
  const submission = reviewData?.submission;
  const eventRows = reviewData?.eventRows || [];
  const reference = reviewData?.reference;
  const comparison = reviewData?.comparison;

  const fps = assignment?.fps || FPS;
  const frameDuration = 1 / fps;
  const maxTime = assignment?.durationSeconds || 30;
  const currentFrame = Math.round(currentTime * fps);
  const isPaused = playMode === 'paused' || playMode === 'frame-auto';

  const submissionEvents = submission?.events || [];
  const referenceEvents = reference?.hasReference ? reference.events : [];

  const eventFrames = useMemo(
    () => buildSortedEventFrames(submissionEvents, referenceEvents, fps),
    [submissionEvents, referenceEvents, fps]
  );

  useEffect(() => {
    playModeRef.current = playMode;
  }, [playMode]);

  useEffect(() => {
    eventPlaybackModeRef.current = eventPlaybackMode;
  }, [eventPlaybackMode]);

  const resetSkippedFrames = useCallback(() => {
    skippedEventFramesRef.current = new Set();
  }, []);

  const pauseAtEventFrame = useCallback(
    (frame) => {
      const video = videoRef.current;
      if (!video) return;

      const time = getTimeForFrame(frame, fps);
      video.pause();
      video.currentTime = time;
      setCurrentTime(time);
      setPlayMode('paused');
      setPausedAtEvent(true);
    },
    [fps]
  );

  const shouldPauseAtFrame = useCallback((frame) => {
    if (eventPlaybackModeRef.current !== 'auto-pause') return false;
    if (!isEventFrame(frame, eventFrames)) return false;
    return !skippedEventFramesRef.current.has(frame);
  }, [eventFrames]);

  const checkPauseAtCurrentFrame = useCallback(
    (time) => {
      const frame = getFrameNumber(time, fps);
      if (shouldPauseAtFrame(frame)) {
        pauseAtEventFrame(frame);
        return true;
      }
      return false;
    },
    [fps, shouldPauseAtFrame, pauseAtEventFrame]
  );

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.getReviewSubmission(submissionId), api.getFinanceSettings()])
      .then(([data, settings]) => {
        setReviewData(data);
        setReviewPoints(data.submission?.reviewPoints || 80);
        setReviewerNotes(data.submission?.reviewerNotes || '');
        setRatePerPoint(settings.ratePerPoint);
        setCurrency(settings.currency || 'USD');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [submissionId]);

  useEffect(load, [load]);

  const stopFrameAutoPlay = useCallback(() => {
    if (frameAutoTimerRef.current) {
      clearInterval(frameAutoTimerRef.current);
      frameAutoTimerRef.current = null;
    }
  }, []);

  const pauseAll = useCallback(() => {
    stopFrameAutoPlay();
    videoRef.current?.pause();
    setPlayMode('paused');
  }, [stopFrameAutoPlay]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || playModeRef.current !== 'normal') return;

    const time = video.currentTime;
    setCurrentTime(time);

    if (checkPauseAtCurrentFrame(time)) {
      stopFrameAutoPlay();
    }
  }, [checkPauseAtCurrentFrame, stopFrameAutoPlay]);

  useEffect(() => () => stopFrameAutoPlay(), [stopFrameAutoPlay]);

  const seekTo = useCallback(
    (time, { clearEventPause = true } = {}) => {
      const clamped = Math.max(0, Math.min(maxTime, time));
      if (videoRef.current) {
        videoRef.current.currentTime = clamped;
        setCurrentTime(clamped);
      }
      if (clearEventPause) {
        setPausedAtEvent(false);
      }
    },
    [maxTime]
  );

  const stepFrames = useCallback(
    (count) => {
      pauseAll();
      const t = videoRef.current?.currentTime ?? currentTime;
      seekTo(t + frameDuration * count);
    },
    [pauseAll, seekTo, frameDuration, currentTime]
  );

  const playNormal = useCallback(async () => {
    stopFrameAutoPlay();
    const video = videoRef.current;
    if (!video) return;
    setPausedAtEvent(false);
    try {
      await video.play();
      setPlayMode('normal');
      checkPauseAtCurrentFrame(video.currentTime);
    } catch {
      setPlayMode('paused');
    }
  }, [stopFrameAutoPlay, checkPauseAtCurrentFrame]);

  const skipEventAndPlay = useCallback(async () => {
    skippedEventFramesRef.current.add(getFrameNumber(currentTime, fps));
    setPausedAtEvent(false);
    await playNormal();
  }, [currentTime, fps, playNormal]);

  const goToEventFrame = useCallback(
    (frame) => {
      if (frame == null) return;
      pauseAll();
      seekTo(getTimeForFrame(frame, fps));
    },
    [pauseAll, seekTo, fps]
  );

  const goToNextEvent = useCallback(() => {
    const next = findNextEventFrame(currentFrame, eventFrames);
    if (next != null) goToEventFrame(next);
  }, [currentFrame, eventFrames, goToEventFrame]);

  const goToPrevEvent = useCallback(() => {
    const prev = findPrevEventFrame(currentFrame, eventFrames);
    if (prev != null) goToEventFrame(prev);
  }, [currentFrame, eventFrames, goToEventFrame]);

  const toggleFrameAutoPlay = useCallback(() => {
    if (playMode === 'frame-auto') {
      pauseAll();
      return;
    }

    stopFrameAutoPlay();
    videoRef.current?.pause();
    setPlayMode('frame-auto');

    frameAutoTimerRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      const next = video.currentTime + frameDuration;
      if (next >= maxTime) {
        seekTo(maxTime);
        pauseAll();
        return;
      }

      seekTo(next, { clearEventPause: false });
      const frame = getFrameNumber(next, fps);
      if (shouldPauseAtFrame(frame)) {
        pauseAtEventFrame(frame);
        stopFrameAutoPlay();
      }
    }, FRAME_PLAY_INTERVAL_MS);
  }, [
    playMode,
    pauseAll,
    stopFrameAutoPlay,
    frameDuration,
    maxTime,
    seekTo,
    fps,
    shouldPauseAtFrame,
    pauseAtEventFrame,
  ]);

  const togglePlayPause = useCallback(() => {
    if (playMode === 'normal' || playMode === 'frame-auto') {
      pauseAll();
      return;
    }
    resetSkippedFrames();
    playNormal();
  }, [playMode, pauseAll, playNormal, resetSkippedFrames]);

  const handleScrub = (time) => {
    pauseAll();
    resetSkippedFrames();
    seekTo(time);
  };

  const handleEventPlaybackModeChange = (mode) => {
    setEventPlaybackMode(mode);
    setPausedAtEvent(false);
    if (mode === 'skip') {
      resetSkippedFrames();
    }
  };

  const validateEvent = async (eventIndex, status) => {
    setSaving(true);
    setError('');
    try {
      const data = await api.validateSubmissionEvents(submissionId, { eventIndex, status });
      setReviewData(data);
      setMessage(`Marked ${status}`);
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const validateAll = async (status) => {
    setSaving(true);
    setError('');
    try {
      const data = await api.validateSubmissionEvents(submissionId, { validateAll: true, status });
      setReviewData(data);
      setMessage(`All events marked ${status}`);
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const autoValidateFromComparison = async () => {
    setSaving(true);
    setError('');
    try {
      const data = await api.validateSubmissionEvents(submissionId, {
        autoFromComparison: true,
      });
      setReviewData(data);
      setMessage('Validated from reference comparison');
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitReview = async (status) => {
    setSaving(true);
    setError('');
    try {
      await api.reviewSubmission(submissionId, {
        status,
        reviewPoints: status === 'approved' ? reviewPoints : 0,
        reviewerNotes,
      });
      setMessage(status === 'approved' ? 'Submission approved' : 'Submission rejected');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (isEditableTarget(event.target)) return;

      const { key, shiftKey } = event;

      if (!shiftKey && (key === 'ArrowLeft' || key === ',')) {
        event.preventDefault();
        stepFrames(-1);
        return;
      }
      if (!shiftKey && (key === 'ArrowRight' || key === '.')) {
        event.preventDefault();
        stepFrames(1);
        return;
      }
      if (shiftKey && (key === 'ArrowLeft' || key === ',')) {
        event.preventDefault();
        stepFrames(-5);
        return;
      }
      if (shiftKey && (key === 'ArrowRight' || key === '.')) {
        event.preventDefault();
        stepFrames(5);
        return;
      }
      if (key === ' ') {
        event.preventDefault();
        togglePlayPause();
        return;
      }
      if (key === 'f' || key === 'F') {
        event.preventDefault();
        toggleFrameAutoPlay();
        return;
      }
      if (key === 'g' || key === 'G') {
        event.preventDefault();
        setMagnifyEnabled((v) => !v);
        return;
      }
      if (key === 'v' || key === 'V') {
        const row = eventRows.find(
          (item) => Math.round(item.event.frameTime * fps) === Math.round(currentTime * fps)
        );
        if (row) {
          event.preventDefault();
          validateEvent(row.eventIndex, 'valid');
        }
      }
      if (key === 'x' || key === 'X') {
        const row = eventRows.find(
          (item) => Math.round(item.event.frameTime * fps) === Math.round(currentTime * fps)
        );
        if (row) {
          event.preventDefault();
          validateEvent(row.eventIndex, 'invalid');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stepFrames, togglePlayPause, toggleFrameAutoPlay, eventRows, currentTime, fps]);

  if (loading) return <div className="loading">Loading review...</div>;
  if (error && !reviewData) return <div className="alert alert-error">{error}</div>;

  const earnings = Math.round(reviewPoints * ratePerPoint * 100) / 100;
  const validatedCount = eventRows.filter((row) => row.validation.status !== 'pending').length;

  return (
    <div className="labeling-page review-page">
      <div className="page-header">
        <h1>{assignment?.title}</h1>
        <p>
          Labeller: <strong>{submission?.userId?.name}</strong> · {submission?.events?.length || 0}{' '}
          events · Validated {validatedCount}/{eventRows.length} · Status:{' '}
          <strong>{submission?.status}</strong>
        </p>
        {reference?.hasReference && comparison?.summary && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Reference: {reference.annotationCount} events · Matched {comparison.summary.matchedCount} ·
            Missing {comparison.summary.missingCount} · Extra {comparison.summary.extraCount}
            {comparison.summary.accuracy != null && ` · Accuracy ${comparison.summary.accuracy}%`}
          </p>
        )}
        <Link to="/review" style={{ fontSize: '0.88rem' }}>
          ← Back to review queue
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

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
              onTimeUpdate={handleTimeUpdate}
              onEnded={pauseAll}
              onPause={() => {
                if (playMode === 'normal') setPlayMode('paused');
              }}
            />
          </FrameMagnifier>

          <div className="video-controls">
            <div className="video-controls-row">
              <span className="time-display">{formatTime(currentTime)}</span>
              <span className="frame-display">Frame {currentFrame}</span>
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
            <div className="video-controls-row review-playback-options">
              <span className="review-playback-label">Event playback</span>
              <label className="review-playback-toggle">
                <input
                  type="radio"
                  name="eventPlaybackMode"
                  checked={eventPlaybackMode === 'auto-pause'}
                  onChange={() => handleEventPlaybackModeChange('auto-pause')}
                />
                Auto-pause at events
              </label>
              <label className="review-playback-toggle">
                <input
                  type="radio"
                  name="eventPlaybackMode"
                  checked={eventPlaybackMode === 'skip'}
                  onChange={() => handleEventPlaybackModeChange('skip')}
                />
                Skip events
              </label>
              {pausedAtEvent && eventPlaybackMode === 'auto-pause' && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={skipEventAndPlay}
                >
                  Skip &amp; play
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={goToPrevEvent}
                disabled={findPrevEventFrame(currentFrame, eventFrames) == null}
              >
                Prev event
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={goToNextEvent}
                disabled={findNextEventFrame(currentFrame, eventFrames) == null}
              >
                Next event
              </button>
            </div>
            <div className="video-controls-row playback-controls">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => stepFrames(-5)}>
                −5 frames
              </button>
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
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => stepFrames(5)}>
                +5 frames
              </button>
              <button
                type="button"
                className={`btn btn-sm${playMode === 'frame-auto' ? ' btn-primary' : ' btn-secondary'}`}
                onClick={toggleFrameAutoPlay}
              >
                {playMode === 'frame-auto' ? 'Stop frame play' : 'Frame play'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={pauseAll}>
                Stop
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
            labellerName={submission?.userId?.name || 'Submitter'}
            hasReference={reference?.hasReference}
            saving={saving}
            onSeek={handleScrub}
            onValidateEvent={validateEvent}
            onValidateAll={validateAll}
            onAutoValidate={autoValidateFromComparison}
          />

          {submission?.status === 'submitted' && (
            <div className="review-final-bar">
              <div className="review-final-score">
                <label>Points</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={reviewPoints}
                  onChange={(e) => setReviewPoints(parseInt(e.target.value, 10))}
                  className="points-slider"
                />
                <span>
                  <strong>{reviewPoints}</strong> → {formatMoney(earnings, currency)}
                </span>
              </div>
              <textarea
                rows={2}
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="Review notes..."
                className="review-final-notes"
              />
              <div className="review-final-actions">
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => submitReview('rejected')}
                  disabled={saving}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => submitReview('approved')}
                  disabled={saving}
                >
                  Approve — {formatMoney(earnings, currency)}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
