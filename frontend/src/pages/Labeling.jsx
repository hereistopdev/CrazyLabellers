import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { isAdmin, isLabeller } from '../utils/roles';
import {
  applyFrameOffset,
  formatOffset,
  FPS,
  getImmediateFollowUpRule,
  resolveFrameOffset,
} from '../config/frameOffsets';
import FrameMagnifier from '../components/FrameMagnifier';
import EventPickerModal from '../components/EventPickerModal';
import LabelingScoreModal from '../components/LabelingScoreModal';
import TutorialPanel from '../components/TutorialPanel';
import TutorialEditorPanel from '../components/TutorialEditorPanel';
import ReviewTimeline from '../components/ReviewTimeline';
import ReferenceEventsPanel from '../components/ReferenceEventsPanel';
import { resolvePlaybackDuration } from '../utils/videoDuration';
import { isEditableTarget, LABELING_HOTKEYS } from '../config/labelingHotkeys';
import { displayAssignmentTitle } from '../utils/displayTitle';

const FRAME_PLAY_INTERVAL_MS = 500;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2);
  return `${m}:${s.padStart(5, '0')}`;
}

export default function Labeling() {
  const { id } = useParams();
  const { user, refreshUser } = useAuth();
  const adminMode = isAdmin(user);
  const labellerMode = isLabeller(user);
  const videoRef = useRef(null);
  const frameAutoTimerRef = useRef(null);
  const [assignment, setAssignment] = useState(null);
  const [eventTypes, setEventTypes] = useState([]);
  const [events, setEvents] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [playMode, setPlayMode] = useState('paused');
  const [magnifyEnabled, setMagnifyEnabled] = useState(false);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [gradingResult, setGradingResult] = useState(null);
  const [mediaDuration, setMediaDuration] = useState(null);
  const [reference, setReference] = useState(null);
  const [tutorialDone, setTutorialDone] = useState(false);

  const fps = assignment?.fps || FPS;
  const frameDuration = 1 / fps;
  const maxTime = resolvePlaybackDuration(mediaDuration, assignment?.durationSeconds);
  const currentFrame = Math.round(currentTime * fps);
  const isPaused = playMode === 'paused' || playMode === 'frame-auto';

  const lastEvent = events.length > 0 ? events[events.length - 1] : null;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      setAssignment(null);
      setEvents([]);

      try {
        let assign;
        try {
          assign = await api.getAssignment(id);
        } catch (assignErr) {
          if (labellerMode) {
            assign = await api.getTutorialAssignment(id);
          } else {
            throw assignErr;
          }
        }

        if (cancelled) return;

        const [types, labels] = await Promise.all([
          api.getEvents(),
          assign.kind === 'tutorial' && labellerMode
            ? Promise.resolve({ events: [] })
            : api.getLabels(id).catch(() => ({ events: [] })),
        ]);

        if (cancelled) return;

        setAssignment(assign);
        setEventTypes(types);
        setEvents(labels.events || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, labellerMode]);

  useEffect(() => {
    if (!labellerMode || assignment?.kind !== 'tutorial') {
      setTutorialDone(false);
      return;
    }

    api
      .getTutorialStatus()
      .then((status) => {
        const match = status.tutorials?.find((t) => String(t.id) === id);
        setTutorialDone(Boolean(match?.completed));
      })
      .catch(() => {});
  }, [id, labellerMode, assignment?.kind]);

  useEffect(() => {
    if (!adminMode || !id) {
      setReference(null);
      return;
    }

    api
      .getReviewPreview(id)
      .then((data) => setReference(data.reference || null))
      .catch(() => setReference(null));
  }, [adminMode, id]);

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

  useEffect(() => () => stopFrameAutoPlay(), [stopFrameAutoPlay]);

  const seekTo = useCallback((time) => {
    const clamped = Math.max(0, Math.min(maxTime, time));
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
      setCurrentTime(clamped);
    }
  }, [maxTime]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current && playMode === 'normal') {
      const t = videoRef.current.currentTime;
      if (t > maxTime) {
        seekTo(maxTime);
        pauseAll();
        return;
      }
      setCurrentTime(t);
    }
  }, [playMode, maxTime, seekTo, pauseAll]);

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
    try {
      await video.play();
      setPlayMode('normal');
    } catch {
      setPlayMode('paused');
    }
  }, [stopFrameAutoPlay]);

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

      seekTo(next);
    }, FRAME_PLAY_INTERVAL_MS);
  }, [playMode, pauseAll, stopFrameAutoPlay, frameDuration, maxTime, seekTo]);

  const togglePlayPause = useCallback(() => {
    if (playMode === 'normal') {
      pauseAll();
      return;
    }
    if (playMode === 'frame-auto') {
      pauseAll();
      return;
    }
    playNormal();
  }, [playMode, pauseAll, playNormal]);

  const openEventPicker = useCallback(() => {
    pauseAll();
    setShowEventPicker(true);
  }, [pauseAll]);

  const markEvent = useCallback(
    async (eventType) => {
      pauseAll();
      const playheadTime = videoRef.current?.currentTime ?? currentTime;
      const followUpRule = lastEvent
        ? getImmediateFollowUpRule(lastEvent.eventType, eventType)
        : null;
      const useFollowUp = Boolean(followUpRule);
      const options = {
        immediateFollowUp: useFollowUp,
        afterEvent: useFollowUp ? lastEvent?.eventType : null,
      };
      const adjustedTime = applyFrameOffset(playheadTime, eventType, options);
      const offset = resolveFrameOffset(eventType, options);

      const newEvents = [
        ...events,
        {
          eventType,
          frameTime: adjustedTime,
          playheadTime: parseFloat(playheadTime.toFixed(3)),
          frameOffset: offset,
          immediateFollowUp: useFollowUp,
          afterEvent: useFollowUp ? lastEvent?.eventType : undefined,
          notes: '',
        },
      ].sort((a, b) => a.frameTime - b.frameTime);

      setEvents(newEvents);
      setShowEventPicker(false);
      setError('');

      try {
        await api.saveLabels(id, { events: newEvents, status: 'draft' });
        setMessage(
          `Marked ${eventType} at ${formatTime(adjustedTime)} (${formatOffset(offset)} frames) — saved`
        );
        setTimeout(() => setMessage(''), 2500);
      } catch (err) {
        setError(err.message);
      }
    },
    [pauseAll, currentTime, lastEvent, events, id]
  );

  const save = useCallback(
    async (status = 'draft') => {
      setSaving(true);
      setError('');
      try {
        const data = await api.saveLabels(id, { events, status });
        if (status === 'submitted' && data.tutorial?.completed) {
          await refreshUser();
          setMessage('Tutorial completed! Continue to the next tutorial or pre-test.');
        if (status === 'submitted' && assignment?.kind === 'pretest') {
          if (data.grading) {
            setGradingResult(data.grading);
          }
          await refreshUser();
          if (data.grading && !data.grading.error) {
            setMessage(
              data.grading.passed
                ? `Pre-test passed — ${data.grading.autoScore}/100`
                : `Score: ${data.grading.autoScore}/100 — try another clip for 80+`
            );
          } else {
            setMessage('Submitted but could not auto-score against reference data.');
          }
        } else if (status === 'submitted') {
          setMessage('Submitted for review!');
        } else {
          setMessage('Draft saved');
        }
        if (status === 'submitted') {
          setTimeout(() => setMessage(''), 4000);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    },
    [id, events, assignment?.kind, refreshUser]
  );

  const handleCompleteTutorial = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      const data = await api.completeTutorial(id);
      setTutorialDone(true);
      await refreshUser();
      setMessage(
        data.tutorialsCompleted
          ? 'All tutorials complete! You can continue to the pre-test.'
          : 'Tutorial marked complete.'
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [id, refreshUser]);

  useEffect(() => {
    const tutorialLabeller = labellerMode && assignment?.kind === 'tutorial';

    const onKeyDown = (event) => {
      if (showEventPicker) return;
      if (isEditableTarget(event.target)) return;

      const { key, shiftKey, ctrlKey, metaKey } = event;

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
      if (!tutorialLabeller && (key === 'm' || key === 'M' || key === 'Enter')) {
        event.preventDefault();
        openEventPicker();
        return;
      }
      if (key === 'g' || key === 'G') {
        event.preventDefault();
        setMagnifyEnabled((v) => !v);
        return;
      }
      if (!tutorialLabeller && (ctrlKey || metaKey) && key === 's') {
        event.preventDefault();
        save('draft');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    showEventPicker,
    stepFrames,
    togglePlayPause,
    toggleFrameAutoPlay,
    openEventPicker,
    save,
    labellerMode,
    assignment?.kind,
  ]);

  const removeEvent = async (index) => {
    const newEvents = events.filter((_, i) => i !== index);
    setEvents(newEvents);
    try {
      await api.saveLabels(id, { events: newEvents, status: 'draft' });
      setMessage('Event removed — saved');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExport = async (variant) => {
    try {
      await api.exportLabels(id, variant);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleScrub = (time) => {
    pauseAll();
    seekTo(time);
  };

  const handleVideoEnded = () => {
    pauseAll();
  };

  const isTutorial = assignment?.kind === 'tutorial';
  const tutorialLabellerMode = labellerMode && isTutorial;
  const showTutorialEditor = adminMode && isTutorial;
  const showTutorialGuide = tutorialLabellerMode;
  const referenceEvents = reference?.hasReference ? reference.events : [];
  const showReference = adminMode && reference?.hasReference;

  if (loading) return <div className="loading">Loading labeler...</div>;
  if (error && !assignment) {
    return (
      <div>
        <div className="alert alert-error">{error}</div>
        {labellerMode && (
          <Link to="/tutorials" className="btn btn-secondary btn-sm">
            Back to tutorials
          </Link>
        )}
      </div>
    );
  }

  const backTo = adminMode
    ? '/admin/videos'
    : isTutorial
      ? '/tutorials'
      : assignment?.kind === 'pretest'
        ? '/labeling-test'
        : '/assignments';

  const backLabel = adminMode
    ? 'videos'
    : isTutorial
      ? 'tutorials'
      : assignment?.kind === 'pretest'
        ? 'labeling test'
        : 'assignments';

  return (
    <div className="labeling-page">
      <div className="page-header">
        <h1>{displayAssignmentTitle(assignment)}</h1>
        <p>{assignment?.description}</p>
        {adminMode && (
          <p style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>
            Admin preview
            {isTutorial ? ' — edit tutorial explanations in the panel beside the video.' : ''}
            {showReference && (
              <>
                {' '}
                · Reference JSON loaded ({reference.annotationCount} events) — shown on video and
                timeline
              </>
            )}
          </p>
        )}
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Clip frame rate: <strong>{fps} fps</strong> — step ±1 or ±5 frames; frame play holds each frame for 0.5s.
          {showTutorialGuide && (
            <>
              {' '}
              · <strong>Tutorial</strong> — follow the frame explanations; no labeling submission
              required.
            </>
          )}
          {assignment?.kind === 'pretest' && (
            <>
              {' '}
              · <strong>Pre-test</strong> — submit to see your auto score vs reference (free practice).
            </>
          )}
        </p>
        <Link to={backTo} style={{ fontSize: '0.88rem' }}>
          ← Back to {backLabel}
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="labeling-workspace">
        <aside className="labeling-hotkeys-sidebar">
          <h3>Hotkeys</h3>
          <div className="hotkeys-panel">
            {LABELING_HOTKEYS.map((item) => (
              <div key={item.keys} className="hotkey-row">
                <kbd>{item.keys}</kbd>
                <span>{item.action}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className={`labeling-layout${isTutorial ? ' labeling-layout--tutorial' : ''}`}>
        <div className="video-panel">
          <FrameMagnifier
            videoRef={videoRef}
            currentTime={currentTime}
            isPaused={isPaused}
            enabled={magnifyEnabled}
            onEnabledChange={setMagnifyEnabled}
            submissionEvents={events}
            referenceEvents={showReference ? referenceEvents : []}
            fps={fps}
          >
            <video
              ref={videoRef}
              src={assignment?.videoUrl}
              crossOrigin="anonymous"
              preload="auto"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleVideoEnded}
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

          {showReference && (
            <ReviewTimeline
              currentTime={currentTime}
              maxTime={maxTime}
              fps={fps}
              submissionEvents={events}
              referenceEvents={referenceEvents}
              labellerName="Draft labels"
              hasReference
              previewMode
              onSeek={handleScrub}
            />
          )}
        </div>

        {showTutorialEditor && (
          <TutorialEditorPanel
            assignment={assignment}
            currentTime={currentTime}
            fps={fps}
            eventTypes={eventTypes}
            onJumpToStep={handleScrub}
            onSaved={(updated) => setAssignment(updated)}
          />
        )}

        {showTutorialGuide && (
          <TutorialPanel
            assignment={assignment}
            currentTime={currentTime}
            fps={fps}
            onJumpToStep={handleScrub}
          />
        )}

        {tutorialLabellerMode ? (
          <div className="events-panel tutorial-complete-panel">
            <h3>Tutorial complete</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Review the explanations beside the video. When you understand the clip, mark it
              complete — nothing is sent to a validator for review.
            </p>
            <div className="actions-row" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleCompleteTutorial}
                disabled={saving || tutorialDone}
              >
                {tutorialDone ? 'Completed' : 'Mark tutorial complete'}
              </button>
              <Link to="/tutorials" className="btn btn-secondary btn-sm">
                Back to tutorials
              </Link>
            </div>
            {tutorialDone && (
              <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--accent)' }}>
                You can reopen this tutorial anytime to review.
              </p>
            )}
          </div>
        ) : (
        <div className="events-panel">
          {showReference && (
            <ReferenceEventsPanel
              referenceEvents={referenceEvents}
              currentTime={currentTime}
              fps={fps}
              annotationCount={reference.annotationCount}
              onSeek={handleScrub}
            />
          )}

          <h3>Add event</h3>
          <p className="offset-hint">
            Default: <strong>−2</strong> · Pass/Shot: <strong>−3</strong> · Goal/Ball Out: <strong>+1</strong>
            · Immediate follow-up: <strong>0</strong> at touch
          </p>
          <div className="mark-panel">
            <p className="mark-hint">
              Pause on the frame, then press <kbd>Enter</kbd> or <kbd>M</kbd> to pick an event.
              Each mark auto-saves.
            </p>
            <button type="button" className="btn btn-primary btn-sm" onClick={openEventPicker}>
              Mark event at {formatTime(currentTime)}
            </button>
            {lastEvent && (
              <p className="mark-hint last-event">
                Last: {lastEvent.eventType} at {formatTime(lastEvent.frameTime)}
              </p>
            )}
          </div>

          <h3>Events ({events.length})</h3>
          <div className="events-list">
            {events.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No events marked yet</p>
            ) : (
              events.map((ev, i) => (
                <div key={`${ev.eventType}-${ev.frameTime}-${i}`} className="event-row">
                  <span className="time">{formatTime(ev.frameTime)}</span>
                  <span className="type">
                    {ev.eventType}
                    {ev.frameOffset !== undefined && (
                      <span className="event-offset"> ({formatOffset(ev.frameOffset)}f)</span>
                    )}
                    {ev.immediateFollowUp && (
                      <span className="event-followup"> ↳ after {ev.afterEvent}</span>
                    )}
                  </span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleScrub(ev.frameTime)}>
                    Go
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => removeEvent(i)}>
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="actions-row" style={{ marginTop: '1rem' }}>
            {assignment?.clipId && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleExport('post')}
                  title={`Download ${assignment.clipId}_post.json`}
                >
                  Export _post.json
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleExport('raw')}
                  title={`Download ${assignment.clipId}.json`}
                >
                  Export .json
                </button>
              </>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => save('draft')} disabled={saving}>
              Save draft
            </button>
            {labellerMode && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => save('submitted')}
                disabled={saving || events.length === 0}
              >
                Submit
              </button>
            )}
          </div>
        </div>
        )}
        </div>
      </div>

      <EventPickerModal
        open={showEventPicker}
        eventTypes={eventTypes}
        lastEvent={lastEvent}
        currentTime={currentTime}
        onSelect={markEvent}
        onClose={() => setShowEventPicker(false)}
      />

      {gradingResult && (
        <LabelingScoreModal
          grading={gradingResult}
          assignmentTitle={assignment?.title}
          onClose={() => setGradingResult(null)}
        />
      )}
    </div>
  );
}
