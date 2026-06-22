import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { isAdmin, isLabeller } from '../utils/roles';
import {
  applyFrameOffset,
  formatOffset,
  FPS,
  getImmediateFollowUpRule,
  resolveFrameOffset,
  frameOffsetSummary,
} from '../config/frameOffsets';
import FrameMagnifier from '../components/FrameMagnifier';
import TutorialEventOverlay from '../components/TutorialEventOverlay';
import EventPickerModal from '../components/EventPickerModal';
import TutorialPanel from '../components/TutorialPanel';
import TutorialEditorPanel from '../components/TutorialEditorPanel';
import ReviewTimeline from '../components/ReviewTimeline';
import ReferenceEventsPanel from '../components/ReferenceEventsPanel';
import FrameNudgeRow from '../components/FrameNudgeRow';
import EventDiscussionFlag from '../components/EventDiscussionFlag';
import LabelingChatbot from '../components/LabelingChatbot';
import ToastStack from '../components/ToastStack';
import { resolvePlaybackDuration } from '../utils/videoDuration';
import { isEditableTarget, LABELING_HOTKEYS } from '../config/labelingHotkeys';
import { displayAssignmentTitle } from '../utils/displayTitle';
import { useToasts } from '../hooks/useToasts';
import {
  getFrameNumber,
  getTimeForFrame,
  snapTimeToFrame,
  formatEventTime,
  nudgeFrameTime,
} from '../utils/frameTime';

const FRAME_PLAY_INTERVAL_MS = 500;

function formatTime(seconds, fps = FPS) {
  return formatEventTime(seconds, fps);
}

export default function Labeling() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const adminMode = isAdmin(user);
  const labellerMode = isLabeller(user);
  const videoRef = useRef(null);
  const frameAutoTimerRef = useRef(null);
  const activeEventRef = useRef(null);
  const eventsRef = useRef([]);
  const discussionNotesRef = useRef({});
  const [assignment, setAssignment] = useState(null);
  const [eventTypes, setEventTypes] = useState([]);
  const [events, setEvents] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { toasts, pushToast, dismissToast } = useToasts();
  const [playMode, setPlayMode] = useState('paused');
  const [magnifyEnabled, setMagnifyEnabled] = useState(false);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [mediaDuration, setMediaDuration] = useState(null);
  const [reference, setReference] = useState(null);
  const [submissionStatus, setSubmissionStatus] = useState('draft');
  const [tutorialDone, setTutorialDone] = useState(false);

  const fps = assignment?.fps || FPS;
  const frameDuration = 1 / fps;
  const maxTime = resolvePlaybackDuration(mediaDuration, assignment?.durationSeconds);
  const currentFrame = getFrameNumber(currentTime, fps);
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

        if (
          labellerMode &&
          assign.kind === 'pretest' &&
          labels.status === 'submitted'
        ) {
          if (!labels.pretestScoreReviewSeenAt) {
            navigate(`/labeling-test/${id}/review`, { replace: true });
            return;
          }
          navigate('/labeling-test', {
            replace: true,
            state: {
              message: 'This pre-test clip is complete. Open another clip from the list.',
            },
          });
          return;
        }

        setAssignment(assign);
        setEventTypes(types);
        setEvents(labels.events || []);
        setSubmissionStatus(labels.status || 'draft');
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
  }, [id, labellerMode, navigate]);

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
    if (!id) {
      setReference(null);
      return;
    }

    const labellerReferenceMode =
      labellerMode && assignment?.allowLabellerReference && assignment?.kind !== 'tutorial';

    if (!adminMode && !labellerReferenceMode) {
      setReference(null);
      return;
    }

    const loader = adminMode
      ? api.getReviewPreview(id).then((data) => data.reference || null)
      : api.getAssignmentReference(id);

    loader
      .then((ref) => setReference(ref?.hasReference != null ? ref : { hasReference: false, events: [] }))
      .catch(() => setReference(null));
  }, [adminMode, labellerMode, id, assignment?.allowLabellerReference, assignment?.kind]);

  useEffect(() => {
    setMediaDuration(null);
  }, [assignment?.videoUrl]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

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

  useEffect(() => {
    activeEventRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentFrame]);

  const seekTo = useCallback((time) => {
    const snapped = snapTimeToFrame(time, fps);
    const clamped = Math.max(0, Math.min(maxTime, snapped));
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
      setCurrentTime(clamped);
    }
  }, [maxTime, fps]);

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
      const frame = getFrameNumber(videoRef.current?.currentTime ?? currentTime, fps) + count;
      seekTo(getTimeForFrame(Math.max(0, frame), fps));
    },
    [pauseAll, seekTo, fps, currentTime]
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

      const nextFrame = getFrameNumber(video.currentTime, fps) + 1;
      if (getTimeForFrame(nextFrame, fps) >= maxTime) {
        seekTo(maxTime);
        pauseAll();
        return;
      }

      seekTo(getTimeForFrame(nextFrame, fps));
    }, FRAME_PLAY_INTERVAL_MS);
  }, [playMode, pauseAll, stopFrameAutoPlay, fps, maxTime, seekTo]);

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
      const playheadTime = snapTimeToFrame(videoRef.current?.currentTime ?? currentTime, fps);
      const followUpRule = lastEvent
        ? getImmediateFollowUpRule(lastEvent.eventType, eventType)
        : null;
      const useFollowUp = Boolean(followUpRule);
      const options = {
        immediateFollowUp: useFollowUp,
        afterEvent: useFollowUp ? lastEvent?.eventType : null,
      };
      const adjustedTime = applyFrameOffset(playheadTime, eventType, options, fps);
      const offset = resolveFrameOffset(eventType, options);

      const newEvents = [
        ...events,
        {
          eventType,
          frameTime: adjustedTime,
          playheadTime,
          frameOffset: offset,
          immediateFollowUp: useFollowUp,
          afterEvent: useFollowUp ? lastEvent?.eventType : undefined,
          needsDiscussion: false,
          notes: '',
        },
      ].sort((a, b) => a.frameTime - b.frameTime);

      setEvents(newEvents);
      setShowEventPicker(false);
      setError('');

      try {
        await api.saveLabels(id, { events: newEvents, status: 'draft' });
        pushToast(
          `Marked ${eventType} at ${formatTime(adjustedTime, fps)} (${formatOffset(offset)} frames) — saved`
        );
      } catch (err) {
        pushToast(err.message, { type: 'error', duration: 4000 });
      }
    },
    [pauseAll, currentTime, lastEvent, events, id, fps, pushToast]
  );

  const save = useCallback(
    async (status = 'draft') => {
      setSaving(true);
      setError('');
      try {
        const data = await api.saveLabels(id, { events, status });
        setSubmissionStatus(data.submission?.status || status);
        if (status === 'submitted' && data.tutorial?.completed) {
          await refreshUser();
          pushToast('Tutorial completed! Continue to the next tutorial or pre-test.', {
            duration: 4000,
          });
        } else if (status === 'submitted' && assignment?.kind === 'pretest') {
          await refreshUser();
          if (data.grading?.scoreReviewUrl) {
            navigate(data.grading.scoreReviewUrl);
            return;
          }
          pushToast('Submitted but could not open score review.', { duration: 4000 });
        } else if (status === 'submitted') {
          const wasSubmitted = submissionStatus === 'submitted';
          const isRelabel =
            labellerMode &&
            assignment?.allowLabellerReference &&
            (submissionStatus === 'rejected' || assignment?.status === 'rejected');
          pushToast(
            wasSubmitted || isRelabel
              ? 'Submission updated — sent back for review'
              : 'Submitted for review!',
            { duration: 4000 }
          );
          setAssignment((prev) => (prev ? { ...prev, status: 'submitted' } : prev));
        } else {
          pushToast('Draft saved');
          if (status === 'draft' && assignment?.status === 'submitted') {
            setAssignment((prev) => (prev ? { ...prev, status: 'in_progress' } : prev));
          }
        }
      } catch (err) {
        pushToast(err.message, { type: 'error', duration: 4000 });
      } finally {
        setSaving(false);
      }
    },
    [
      id,
      events,
      assignment,
      labellerMode,
      submissionStatus,
      refreshUser,
      navigate,
      pushToast,
    ]
  );

  const handleCompleteTutorial = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      const data = await api.completeTutorial(id);
      setTutorialDone(true);
      await refreshUser();
      pushToast(
        data.tutorialsCompleted
          ? 'All tutorials complete! You can continue to the pre-test.'
          : 'Tutorial marked complete.',
        { duration: 4000 }
      );
    } catch (err) {
      pushToast(err.message, { type: 'error', duration: 4000 });
    } finally {
      setSaving(false);
    }
  }, [id, refreshUser, pushToast]);

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
      pushToast('Event removed — saved');
    } catch (err) {
      pushToast(err.message, { type: 'error', duration: 4000 });
    }
  };

  const toggleEventDiscussion = async (index) => {
    const target = eventsRef.current[index];
    if (!target) return;

    const flagged = !target.needsDiscussion;
    const newEvents = eventsRef.current.map((event, i) =>
      i === index
        ? {
            ...event,
            needsDiscussion: flagged,
            notes: flagged ? event.notes || '' : '',
          }
        : event
    );

    setEvents(newEvents);
    try {
      await api.saveLabels(id, { events: newEvents, status: 'draft' });
      if (flagged) {
        discussionNotesRef.current[index] = newEvents[index].notes || '';
      } else {
        delete discussionNotesRef.current[index];
      }
      pushToast(
        flagged ? 'Event flagged for discussion — saved' : 'Discussion flag removed — saved'
      );
    } catch (err) {
      pushToast(err.message, { type: 'error', duration: 4000 });
    }
  };

  const updateEventDiscussionNote = (index, notes) => {
    setEvents((prev) => prev.map((event, i) => (i === index ? { ...event, notes } : event)));
  };

  const saveEventDiscussionNote = async (index) => {
    const snapshot = eventsRef.current;
    const event = snapshot[index];
    if (!event?.needsDiscussion) return;

    const prev = discussionNotesRef.current[index] ?? '';
    const next = event.notes || '';
    if (next === prev) return;

    try {
      await api.saveLabels(id, { events: snapshot, status: 'draft' });
      discussionNotesRef.current[index] = next;
      pushToast('Discussion note saved');
    } catch (err) {
      pushToast(err.message, { type: 'error', duration: 4000 });
    }
  };

  const nudgeEvent = useCallback(
    async (eventIndex, frameDelta) => {
      const target = events[eventIndex];
      if (!target || !frameDelta) return;

      pauseAll();
      const newFrameTime = nudgeFrameTime(target.frameTime, frameDelta, fps);
      const newEvents = events
        .map((event, index) =>
          index === eventIndex ? { ...event, frameTime: newFrameTime } : event
        )
        .sort((a, b) => a.frameTime - b.frameTime);

      setEvents(newEvents);
      seekTo(newFrameTime);

      try {
        await api.saveLabels(id, { events: newEvents, status: 'draft' });
        pushToast(
          `Moved ${target.eventType} to frame ${getFrameNumber(newFrameTime, fps)} — saved`
        );
      } catch (err) {
        pushToast(err.message, { type: 'error', duration: 4000 });
      }
    },
    [events, fps, id, pauseAll, seekTo, pushToast]
  );

  const nudgeEventAtFrame = useCallback(
    (frameDelta, eventIndex) => {
      const index =
        typeof eventIndex === 'number'
          ? eventIndex
          : events.findIndex((event) => getFrameNumber(event.frameTime, fps) === currentFrame);
      if (index < 0) return;
      nudgeEvent(index, frameDelta);
    },
    [events, currentFrame, fps, nudgeEvent]
  );

  const handleExport = async (variant) => {
    try {
      await api.exportLabels(id, variant);
    } catch (err) {
      pushToast(err.message, { type: 'error', duration: 4000 });
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
  const showReference =
    reference?.hasReference &&
    (adminMode || (labellerMode && assignment?.allowLabellerReference));
  const relabelMode =
    labellerMode &&
    assignment?.allowLabellerReference &&
    (submissionStatus === 'rejected' || assignment?.status === 'rejected');
  const pendingReviewResubmit =
    labellerMode &&
    submissionStatus === 'submitted' &&
    assignment?.kind !== 'pretest' &&
    !relabelMode;
  const submissionLocked =
    submissionStatus === 'approved' ||
    (submissionStatus === 'rejected' && !assignment?.allowLabellerReference);
  const canAdjustEvents = !tutorialLabellerMode && !submissionLocked;
  const discussionEventCount = events.filter((event) => event.needsDiscussion).length;

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
      <div className="page-header page-header--with-actions">
        <div className="page-header-main">
        <h1>{displayAssignmentTitle(assignment)}</h1>
        <p>{assignment?.description}</p>
        {showReference && labellerMode && !adminMode && (
          <p style={{ fontSize: '0.85rem', color: '#fbbf24' }}>
            Reference visible — compare gold-standard events (blue) with your labels (green).
            {events.length === 0
              ? ' Your draft starts from reference when you have no labels yet.'
              : ' Your saved labels are kept — adjust with nudge or mark controls,'}{' '}
            then {relabelMode || pendingReviewResubmit ? 're-submit' : 'submit'} when ready.
          </p>
        )}
        {pendingReviewResubmit && (
          <p style={{ fontSize: '0.85rem', color: '#93c5fd' }}>
            Already submitted — you can still edit events and <strong>Re-submit</strong> until a
            validator reviews this task.
          </p>
        )}
        {submissionLocked && submissionStatus === 'approved' && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            This submission is approved and can no longer be edited.
          </p>
        )}
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
        {(labellerMode || adminMode) && (
          <button
            type="button"
            className="labeling-chatbot-trigger"
            onClick={() => setChatOpen(true)}
            aria-label="Open labeling help assistant"
            title="Ask the labeling assistant"
          >
            <span className="labeling-chatbot-trigger-icon" aria-hidden>
              💬
            </span>
            <span className="labeling-chatbot-trigger-label">Help</span>
          </button>
        )}
      </div>

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
            {showTutorialGuide && (
              <TutorialEventOverlay
                steps={assignment?.tutorialSteps}
                currentTime={currentTime}
                fps={fps}
              />
            )}
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
              labellerName={labellerMode && !adminMode ? 'Your labels' : 'Draft labels'}
              hasReference
              previewMode
              onSeek={handleScrub}
              canEditSubmission={canAdjustEvents}
              onNudgeSubmissionEvent={nudgeEventAtFrame}
              saving={saving}
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
        <div className="events-panel events-panel--labeling">
          <div className="events-panel-fixed">
            {showReference && (
              <ReferenceEventsPanel
                referenceEvents={referenceEvents}
                currentTime={currentTime}
                fps={fps}
                annotationCount={reference.annotationCount}
                onSeek={handleScrub}
              />
            )}

            <section className="events-panel-add-event">
              <h3>Add event</h3>
              <p className="offset-hint">
                {frameOffsetSummary}
                · Immediate follow-up: <strong>0</strong> at touch
              </p>
              <div className="mark-panel">
                <p className="mark-hint">
                  Pause on the frame, then press <kbd>Enter</kbd> or <kbd>M</kbd> to pick an event.
                  Each mark auto-saves. Flag uncertain events for validator discussion below.
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
            </section>
          </div>

          <div className="events-panel-scroll">
            <h3>
              Events ({events.length})
              {discussionEventCount > 0 && (
                <span className="events-discussion-count">
                  · {discussionEventCount} flagged for discussion
                </span>
              )}
            </h3>
            {canAdjustEvents && events.some((ev) => getFrameNumber(ev.frameTime, fps) === currentFrame) && (
              <div className="labeling-event-nudge-panel">
                <span className="labeling-event-nudge-label">Adjust event on this frame</span>
                <FrameNudgeRow
                  disabled={saving}
                  onNudge={(delta) => nudgeEventAtFrame(delta)}
                />
              </div>
            )}
            <div className="events-list events-list--labeling">
              {events.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No events marked yet</p>
              ) : (
                events.map((ev, i) => {
                  const isActive = getFrameNumber(ev.frameTime, fps) === currentFrame;
                  return (
                  <div
                    key={`${ev.eventType}-${ev.frameTime}-${i}`}
                    ref={isActive ? activeEventRef : null}
                    className={`event-row-wrap${isActive ? ' active' : ''}${ev.needsDiscussion ? ' needs-discussion' : ''}`}
                  >
                    <div className={`event-row${isActive ? ' active' : ''}${ev.needsDiscussion ? ' needs-discussion' : ''}`}>
                      <span className="time">{formatTime(ev.frameTime)}</span>
                      <span className="type">
                        {ev.needsDiscussion && (
                          <span className="event-discussion-badge" title="Flagged for discussion">
                            ⚑
                          </span>
                        )}
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
                    {canAdjustEvents && isActive && (
                      <FrameNudgeRow disabled={saving} onNudge={(delta) => nudgeEvent(i, delta)} />
                    )}
                    {canAdjustEvents && (
                      <EventDiscussionFlag
                        flagged={Boolean(ev.needsDiscussion)}
                        note={ev.notes || ''}
                        disabled={saving}
                        onToggle={() => toggleEventDiscussion(i)}
                        onNoteChange={(value) => updateEventDiscussionNote(i, value)}
                        onNoteBlur={() => saveEventDiscussionNote(i)}
                      />
                    )}
                  </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="events-panel-footer">
            <div className="actions-row">
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
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => save('draft')} disabled={saving || submissionLocked}>
                Save draft
              </button>
              {labellerMode && canAdjustEvents && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => save('submitted')}
                  disabled={saving || events.length === 0}
                >
                  {pendingReviewResubmit || relabelMode ? 'Re-submit' : 'Submit'}
                </button>
              )}
              {submissionLocked && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {submissionStatus === 'approved'
                    ? 'Approved — no further edits'
                    : 'Rejected — contact admin to re-open'}
                </span>
              )}
            </div>
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

      {(labellerMode || adminMode) && (
        <LabelingChatbot
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          assignment={assignment}
          lastEventType={lastEvent}
          fps={fps}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
