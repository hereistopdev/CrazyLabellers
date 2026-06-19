import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { canAccessReview } from '../utils/roles';
import { FPS, applyFrameOffset, getImmediateFollowUpRule, resolveFrameOffset } from '../config/frameOffsets';
import FrameMagnifier from '../components/FrameMagnifier';
import ReviewTimeline from '../components/ReviewTimeline';
import EventPickerModal from '../components/EventPickerModal';
import { isEditableTarget } from '../config/labelingHotkeys';
import { formatMoney, calcTaskEarnings, effectiveTaskPrice } from '../utils/money';
import StarRating from '../components/StarRating';
import { resolvePlaybackDuration } from '../utils/videoDuration';
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
  const { submissionId, assignmentId } = useParams();
  const { user } = useAuth();
  const canEditReference = canAccessReview(user);
  const isPreview = Boolean(assignmentId);
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
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [aspects, setAspects] = useState({ quality: 5, accuracy: 5, timeliness: 5 });
  const [ratePerPoint, setRatePerPoint] = useState(0.1);
  const [currency, setCurrency] = useState('USD');
  const [mediaDuration, setMediaDuration] = useState(null);
  const [eventTypes, setEventTypes] = useState([]);
  const [editableReferenceEvents, setEditableReferenceEvents] = useState([]);
  const [referenceDirty, setReferenceDirty] = useState(false);
  const [showReferenceEventPicker, setShowReferenceEventPicker] = useState(false);
  const [savingReference, setSavingReference] = useState(false);

  const assignment = reviewData?.assignment;
  const submission = reviewData?.submission;
  const eventRows = reviewData?.eventRows || [];
  const reference = reviewData?.reference;
  const comparison = reviewData?.comparison;

  const fps = assignment?.fps || FPS;
  const frameDuration = 1 / fps;
  const maxTime = resolvePlaybackDuration(mediaDuration, assignment?.durationSeconds);
  const currentFrame = Math.round(currentTime * fps);
  const isPaused = playMode === 'paused' || playMode === 'frame-auto';

  const submissionEvents = submission?.events || [];
  const referenceEvents = canEditReference
    ? editableReferenceEvents
    : reference?.hasReference
      ? reference.events
      : [];

  const lastReferenceEvent = useMemo(() => {
    if (!referenceEvents.length) return null;
    return [...referenceEvents].sort((a, b) => a.frameTime - b.frameTime).at(-1);
  }, [referenceEvents]);

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
    const dataPromise = isPreview
      ? api.getReviewPreview(assignmentId)
      : api.getReviewSubmission(submissionId);
    const settingsPromise = isPreview ? Promise.resolve(null) : api.getFinanceSettings();

    Promise.all([dataPromise, settingsPromise])
      .then(([data, settings]) => {
        setReviewData(data);
        if (!isPreview) {
          const autoScore = data.submission?.autoScore;
          const existingPoints = data.submission?.reviewPoints;
          setReviewPoints(
            existingPoints != null && existingPoints > 0
              ? existingPoints
              : autoScore != null
                ? autoScore
                : 80
          );
          setReviewerNotes(data.submission?.reviewerNotes || '');
          setRatePerPoint(settings.ratePerPoint);
          setCurrency(settings.currency || 'USD');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [submissionId, assignmentId, isPreview]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!canEditReference) return;
    api.getEvents().then(setEventTypes).catch(() => setEventTypes([]));
  }, [canEditReference]);

  useEffect(() => {
    if (!canEditReference) return;
    const events = reviewData?.reference?.events || [];
    setEditableReferenceEvents(events);
    setReferenceDirty(false);
  }, [canEditReference, reviewData?.reference?.events, reviewData?.reference?.annotationCount, assignment?._id]);

  useEffect(() => {
    setMediaDuration(null);
  }, [assignment?.videoUrl]);

  const handleLoadedMetadata = useCallback(() => {
    const duration = videoRef.current?.duration;
    if (Number.isFinite(duration) && duration > 0) {
      setMediaDuration(duration);
    }
  }, []);

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

  const openReferenceEventPicker = useCallback(() => {
    pauseAll();
    setShowReferenceEventPicker(true);
  }, [pauseAll]);

  const addReferenceEvent = useCallback(
    (eventType) => {
      pauseAll();
      const playheadTime = videoRef.current?.currentTime ?? currentTime;
      const followUpRule = lastReferenceEvent
        ? getImmediateFollowUpRule(lastReferenceEvent.eventType, eventType)
        : null;
      const useFollowUp = Boolean(followUpRule);
      const options = {
        immediateFollowUp: useFollowUp,
        afterEvent: useFollowUp ? lastReferenceEvent?.eventType : null,
      };
      const adjustedTime = applyFrameOffset(playheadTime, eventType, options);
      const offset = resolveFrameOffset(eventType, options);

      const newEvents = [
        ...editableReferenceEvents,
        {
          eventType,
          frameTime: adjustedTime,
          playheadTime: parseFloat(playheadTime.toFixed(3)),
          frameOffset: offset,
          immediateFollowUp: useFollowUp,
          afterEvent: useFollowUp ? lastReferenceEvent?.eventType : undefined,
        },
      ].sort((a, b) => a.frameTime - b.frameTime);

      setEditableReferenceEvents(newEvents);
      setReferenceDirty(true);
      setShowReferenceEventPicker(false);
      setMessage(`Added reference ${eventType} at ${formatTime(adjustedTime)} (unsaved)`);
      setTimeout(() => setMessage(''), 2500);
    },
    [pauseAll, currentTime, lastReferenceEvent, editableReferenceEvents]
  );

  const deleteReferenceEventAtFrame = useCallback(() => {
    const frame = Math.round(currentTime * fps);
    const next = editableReferenceEvents.filter(
      (event) => Math.round(event.frameTime * fps) !== frame
    );
    if (next.length === editableReferenceEvents.length) return;
    setEditableReferenceEvents(next);
    setReferenceDirty(true);
    setMessage('Removed reference event on this frame (unsaved)');
    setTimeout(() => setMessage(''), 2000);
  }, [currentTime, fps, editableReferenceEvents]);

  const nudgeReferenceEventAtFrame = useCallback(
    (frameDelta) => {
      const frame = Math.round(currentTime * fps);
      let changed = false;
      const next = editableReferenceEvents
        .map((event) => {
          if (Math.round(event.frameTime * fps) !== frame) return event;
          changed = true;
          return {
            ...event,
            frameTime: Math.max(0, event.frameTime + frameDelta * frameDuration),
          };
        })
        .sort((a, b) => a.frameTime - b.frameTime);
      if (!changed) return;
      setEditableReferenceEvents(next);
      setReferenceDirty(true);
    },
    [currentTime, fps, editableReferenceEvents, frameDuration]
  );

  const saveReferenceEvents = async () => {
    if (!assignment?._id) return;
    setSavingReference(true);
    setError('');
    try {
      const data = await api.updateReviewReference(assignment._id, {
        events: editableReferenceEvents,
        submissionId: isPreview ? undefined : submissionId,
      });
      setReviewData(data);
      setEditableReferenceEvents(data.reference?.events || editableReferenceEvents);
      setReferenceDirty(false);
      if (!isPreview && data.submission?.autoScore != null) {
        setReviewPoints(data.submission.reviewPoints || data.submission.autoScore);
      }
      setMessage('Reference annotations saved');
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingReference(false);
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
        rating: status === 'approved' ? rating : undefined,
        reviewComment: status === 'approved' ? reviewComment : undefined,
        aspects: status === 'approved' ? aspects : undefined,
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

  const taskPrice = effectiveTaskPrice(assignment, assignment?.taskPrice);
  const earnings = calcTaskEarnings(reviewPoints, taskPrice, ratePerPoint, assignment?.kind);
  const maxPayout = calcTaskEarnings(100, taskPrice, ratePerPoint, assignment?.kind);
  const autoScore = reviewData?.autoScore ?? submission?.autoScore;
  const autoScoreBreakdown = reviewData?.autoScoreBreakdown ?? submission?.autoScoreBreakdown;
  const validatedCount = eventRows.filter((row) => row.validation.status !== 'pending').length;

  return (
    <div className="labeling-page review-page">
      <div className="page-header">
        <h1>{assignment?.title}</h1>
        {isPreview ? (
          <p>
            <strong>Preview mode</strong> — watch video and reference annotations before any labeller
            submits work. Assignment status: <strong>{assignment?.status}</strong>
            {reference?.hasReference && (
              <>
                {' '}
                · Reference: {reference.annotationCount} events
              </>
            )}
          </p>
        ) : (
          <p>
            Labeller:{' '}
            <Link to={`/profile/${submission?.userId?._id || submission?.userId}`}>
              <strong>{submission?.userId?.name}</strong>
            </Link>{' '}
            · {submission?.events?.length || 0} events · Validated {validatedCount}/{eventRows.length}{' '}
            · Status: <strong>{submission?.status}</strong>
          </p>
        )}
        {taskPrice > 0 && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Task price: up to {formatMoney(taskPrice)}
            {assignment.challengeNote && ` · ${assignment.challengeNote}`}
          </p>
        )}
        {(assignment?.uploadedBy?.name || assignment?.reviewedBy?.name) && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {assignment?.uploadedBy?.name && (
              <>
                Uploaded by <strong>{assignment.uploadedBy.name}</strong>
              </>
            )}
            {assignment?.referenceUpdatedBy?.name && (
              <>
                {assignment?.uploadedBy?.name ? ' · ' : ''}
                Reference updated by <strong>{assignment.referenceUpdatedBy.name}</strong>
              </>
            )}
            {assignment?.reviewedBy?.name && (
              <>
                {(assignment?.uploadedBy?.name || assignment?.referenceUpdatedBy?.name) ? ' · ' : ''}
                Validated by <strong>{assignment.reviewedBy.name}</strong>
              </>
            )}
          </p>
        )}
        {!isPreview && submission?.reviewedBy?.name && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Review recorded by <strong>{submission.reviewedBy.name}</strong>
            {submission.reviewedAt && ` · ${new Date(submission.reviewedAt).toLocaleString()}`}
          </p>
        )}
        {autoScore != null && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Auto score (reference comparison): <strong>{autoScore}/100</strong>
            {!isPreview && submission?.status === 'submitted' && autoScore !== reviewPoints && (
              <>
                {' '}
                ·{' '}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginLeft: 4, verticalAlign: 'baseline' }}
                  onClick={() => setReviewPoints(autoScore)}
                >
                  Use auto score
                </button>
              </>
            )}
          </p>
        )}
        {reference?.hasReference && comparison?.summary && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Reference: {referenceEvents.length || reference.annotationCount} events · Matched {comparison.summary.matchedCount} ·
            Missing {comparison.summary.missingCount} · Extra {comparison.summary.extraCount}
            {comparison.summary.accuracy != null && ` · Accuracy ${comparison.summary.accuracy}%`}
            {canEditReference && referenceDirty && (
              <>
                {' '}
                · <strong>Unsaved reference edits</strong>
              </>
            )}
          </p>
        )}
        {canEditReference && !reference?.hasReference && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            No reference yet — add events on the timeline and save.
            {referenceDirty && (
              <>
                {' '}
                · <strong>Unsaved reference edits</strong>
              </>
            )}
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
            referenceEvents={referenceEvents}
            fps={fps}
          >
            <video
              ref={videoRef}
              src={assignment?.videoUrl}
              crossOrigin="anonymous"
              preload="auto"
              onLoadedMetadata={handleLoadedMetadata}
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
            referenceEvents={referenceEvents}
            eventRows={eventRows}
            labellerName={isPreview ? 'No submission yet' : submission?.userId?.name || 'Submitter'}
            hasReference={reference?.hasReference || (canEditReference && referenceEvents.length > 0)}
            previewMode={isPreview}
            saving={saving || savingReference}
            canEditReference={canEditReference}
            referenceDirty={referenceDirty}
            onAddReferenceEvent={openReferenceEventPicker}
            onDeleteReferenceEvent={deleteReferenceEventAtFrame}
            onNudgeReferenceEvent={nudgeReferenceEventAtFrame}
            onSaveReference={saveReferenceEvents}
            onSeek={handleScrub}
            onValidateEvent={validateEvent}
            onValidateAll={validateAll}
            onAutoValidate={autoValidateFromComparison}
          />

          {!isPreview && submission?.status === 'submitted' && (
            <div className="review-final-bar">
              {autoScoreBreakdown?.length > 0 && (
                <div className="labeling-score-breakdown" style={{ marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Auto score breakdown</h4>
                  {autoScoreBreakdown.map((item) => (
                    <div key={`${item.eventType}-${item.referenceIndex}`} className="labeling-score-row">
                      <span className="type">{item.eventType}</span>
                      <span className="meta">
                        {item.status === 'missing'
                          ? 'missing'
                          : `${item.frameDiff ?? 0}f off · ${item.score} pts`}
                      </span>
                      <strong>{item.score}</strong>
                    </div>
                  ))}
                </div>
              )}
              <div className="review-final-score">
                <label>Review points</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={reviewPoints}
                  onChange={(e) => setReviewPoints(parseInt(e.target.value, 10) || 0)}
                  className="review-points-input"
                  style={{ width: 72, marginRight: 8 }}
                />
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
                  {taskPrice > 0 && (
                    <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                      (max {formatMoney(maxPayout, currency)})
                    </span>
                  )}
                </span>
              </div>
              <div className="review-rating-block">
                <label>Profile rating</label>
                <StarRating value={rating} onChange={setRating} />
                <div className="review-aspects">
                  {['quality', 'accuracy', 'timeliness'].map((key) => (
                    <label key={key} className="review-aspect-row">
                      <span>{key}</span>
                      <StarRating
                        value={aspects[key]}
                        onChange={(value) => setAspects({ ...aspects, [key]: value })}
                        size="sm"
                      />
                    </label>
                  ))}
                </div>
              </div>
              <textarea
                rows={2}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Public review for labeller profile..."
                className="review-final-notes"
              />
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

      {canEditReference && (
        <EventPickerModal
          open={showReferenceEventPicker}
          eventTypes={eventTypes}
          lastEvent={lastReferenceEvent}
          currentTime={currentTime}
          onSelect={addReferenceEvent}
          onClose={() => setShowReferenceEventPicker(false)}
        />
      )}
    </div>
  );
}
