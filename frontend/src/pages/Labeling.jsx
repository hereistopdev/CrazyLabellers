import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import TutorialEventOverlay from '../components/TutorialEventOverlay';
import EventPickerModal from '../components/EventPickerModal';
import TutorialPanel from '../components/TutorialPanel';
import TutorialEditorPanel from '../components/TutorialEditorPanel';
import ReviewTimeline from '../components/ReviewTimeline';
import ReferenceEventsPanel from '../components/ReferenceEventsPanel';
import FrameNudgeRow from '../components/FrameNudgeRow';
import EventDiscussionFlag, { EventDiscussionNote } from '../components/EventDiscussionFlag';
import LabelingChatbot from '../components/LabelingChatbot';
import LabelingHelpModal from '../components/LabelingHelpModal';
import EventSearchInput from '../components/EventSearchInput';
import ToastStack from '../components/ToastStack';
import { resolvePlaybackDuration } from '../utils/videoDuration';
import { isEditableTarget, LABELING_HOTKEYS, getNumpadFrameNudgeDelta } from '../config/labelingHotkeys';
import { displayAssignmentTitle } from '../utils/displayTitle';
import { useToasts } from '../hooks/useToasts';
import { useSyncElementHeight } from '../hooks/useSyncElementHeight';
import {
  getFrameNumber,
  getTimeForFrame,
  snapTimeToFrame,
  formatEventTime,
  nudgeFrameTime,
  toDisplayFrame,
} from '../utils/frameTime';
import {
  getEventSpacingRuleSummary,
  getEventPairTimingRuleSummary,
} from '../utils/eventSpacingValidation';
import { validateSubmissionLabeling } from '../utils/labelingRulesValidation';
import { countEventSearchMatches, matchesEventSearch } from '../utils/eventSearch';
import { canUseLabeler } from '../utils/labelerAccess';
import { extractClipIdFromVideoUrl, isOpenableVideoUrl, resolvePlaybackVideoUrl } from '../utils/videoUrl';
import { loadPracticeLabels, savePracticeLabels, clearPracticeLabels } from '../utils/practiceLabelStorage';
import { downloadAnnotationExport, resolveExportBasename, getExportFilename } from '../utils/exportAnnotation';

const FRAME_PLAY_INTERVAL_MS = 500;

function formatTime(seconds, fps = FPS) {
  return formatEventTime(seconds, fps);
}

export default function Labeling() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const adminMode = isAdmin(user);
  const labellerMode = isLabeller(user);
  const isPracticeMode = id === 'practice';
  const practiceVideoUrl = isPracticeMode ? searchParams.get('url')?.trim() || '' : '';
  const videoRef = useRef(null);
  const videoDisplayRef = useRef(null);
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
  const [eventPickerMode, setEventPickerMode] = useState('add');
  const [editEventIndex, setEditEventIndex] = useState(null);
  const [selectedEventIndex, setSelectedEventIndex] = useState(null);
  const [showLabelingHelp, setShowLabelingHelp] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [mediaDuration, setMediaDuration] = useState(null);
  const [reference, setReference] = useState(null);
  const [submissionStatus, setSubmissionStatus] = useState('draft');
  const [submissionReview, setSubmissionReview] = useState(null);
  const [tutorialDone, setTutorialDone] = useState(false);
  const [spacingIssueIndices, setSpacingIssueIndices] = useState(() => new Set());
  const [spacingIssues, setSpacingIssues] = useState([]);
  const [eventSearchQuery, setEventSearchQuery] = useState('');

  const fps = assignment?.fps || FPS;
  const frameDuration = 1 / fps;
  const playbackVideoUrl = resolvePlaybackVideoUrl(assignment?.videoUrl);
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

      if (isPracticeMode) {
        if (!user) {
          if (!cancelled) {
            setError('Log in to practice label videos');
            setLoading(false);
          }
          return;
        }

        if (!canUseLabeler(user)) {
          if (!cancelled) {
            setError('Labeller access required for practice labeling');
            setLoading(false);
          }
          return;
        }

        if (!practiceVideoUrl) {
          if (!cancelled) {
            setError('Missing video URL — paste a link from Assignments');
            setLoading(false);
          }
          return;
        }

        if (!isOpenableVideoUrl(practiceVideoUrl)) {
          if (!cancelled) {
            setError('Invalid video URL');
            setLoading(false);
          }
          return;
        }

        try {
          const clipId = extractClipIdFromVideoUrl(practiceVideoUrl);
          const saved = loadPracticeLabels(practiceVideoUrl);
          const [types] = await Promise.all([api.getEvents()]);
          if (cancelled) return;

          setAssignment({
            kind: 'practice',
            title: clipId ? `Practice — ${clipId}` : 'Practice labeling',
            description:
              'Free practice — labels stay in your browser only and are not submitted for review.',
            videoUrl: practiceVideoUrl,
            clipId: clipId || undefined,
            fps: FPS,
            durationSeconds: 30,
          });
          setEventTypes(types);
          setEvents(saved.events || []);
          setSubmissionStatus('draft');
        } catch (err) {
          if (!cancelled) setError(err.message);
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

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
        setSubmissionReview({
          reviewPoints: labels.reviewPoints,
          reviewerNotes: labels.reviewerNotes,
          reviewedAt: labels.reviewedAt,
          originalEvents: labels.originalEvents || [],
          correctionBreakdown: labels.correctionBreakdown,
          correctedAt: labels.correctedAt,
        });
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
  }, [id, labellerMode, navigate, isPracticeMode, practiceVideoUrl, user]);

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
    if (isPracticeMode || !id) {
      setReference(null);
      return;
    }

    const labellerReferenceMode =
      labellerMode &&
      assignment?.kind !== 'tutorial' &&
      (assignment?.allowLabellerReference ||
        submissionStatus === 'approved' ||
        assignment?.status === 'approved');

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
  }, [
    adminMode,
    labellerMode,
    id,
    assignment?.allowLabellerReference,
    assignment?.kind,
    assignment?.status,
    submissionStatus,
  ]);

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
    setEventPickerMode('add');
    setEditEventIndex(null);
    setShowEventPicker(true);
  }, [pauseAll]);

  const reportSpacingValidationFailure = useCallback(
    (validation, summaryMessage) => {
      setSpacingIssues(validation.issues || []);
      setSpacingIssueIndices(new Set(validation.affectedIndices));
      pushToast(summaryMessage, { type: 'error', duration: 5000 });
    },
    [pushToast]
  );

  const persistEvents = useCallback(
    async (newEvents, toastMessage) => {
      if (isPracticeMode) {
        savePracticeLabels(practiceVideoUrl, newEvents);
        if (toastMessage) pushToast(toastMessage);
        return;
      }
      await api.saveLabels(id, { events: newEvents, status: 'draft' });
      if (toastMessage) pushToast(toastMessage);
    },
    [isPracticeMode, practiceVideoUrl, id, pushToast]
  );

  const checkSpacingRules = useCallback(() => {
    const validation = validateSubmissionLabeling(events, fps);
    if (validation.valid) {
      setSpacingIssueIndices(new Set());
      setSpacingIssues([]);
      pushToast('All labeling rules pass');
      return;
    }
    reportSpacingValidationFailure(validation, 'Labeling rule violations found — fix before exporting');
  }, [events, fps, pushToast, reportSpacingValidationFailure]);

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
        await persistEvents(
          newEvents,
          `Marked ${eventType} at ${formatTime(adjustedTime, fps)} (${formatOffset(offset)} frames) — saved`
        );
      } catch (err) {
        pushToast(err.message, { type: 'error', duration: 4000 });
      }
    },
    [pauseAll, currentTime, lastEvent, events, fps, pushToast, persistEvents]
  );

  const resolveSelectedEventIndex = useCallback(() => {
    if (selectedEventIndex != null && events[selectedEventIndex]) {
      return selectedEventIndex;
    }
    return events.findIndex((event) => getFrameNumber(event.frameTime, fps) === currentFrame);
  }, [selectedEventIndex, events, currentFrame, fps]);

  const changeEventType = useCallback(
    async (eventType) => {
      if (editEventIndex == null || !events[editEventIndex]) return;

      pauseAll();
      const target = events[editEventIndex];
      const playheadTime = snapTimeToFrame(target.playheadTime ?? target.frameTime, fps);
      const sortedEvents = [...events].sort((a, b) => a.frameTime - b.frameTime);
      const targetSortedIdx = sortedEvents.indexOf(target);
      const priorEvent = targetSortedIdx > 0 ? sortedEvents[targetSortedIdx - 1] : null;
      const followUpRule = priorEvent
        ? getImmediateFollowUpRule(priorEvent.eventType, eventType)
        : null;
      const useFollowUp = Boolean(followUpRule);
      const options = {
        immediateFollowUp: useFollowUp,
        afterEvent: useFollowUp ? priorEvent?.eventType : null,
      };
      const adjustedTime = applyFrameOffset(playheadTime, eventType, options, fps);
      const offset = resolveFrameOffset(eventType, options);

      const newEvents = events
        .map((event, index) =>
          index === editEventIndex
            ? {
                ...event,
                eventType,
                frameTime: adjustedTime,
                playheadTime,
                frameOffset: offset,
                immediateFollowUp: useFollowUp,
                afterEvent: useFollowUp ? priorEvent?.eventType : undefined,
              }
            : event
        )
        .sort((a, b) => a.frameTime - b.frameTime);

      setEvents(newEvents);
      setShowEventPicker(false);
      setEventPickerMode('add');
      setEditEventIndex(null);

      try {
        await persistEvents(newEvents, `Changed to ${eventType} at ${formatTime(adjustedTime, fps)} — saved`);
        const nextIndex = newEvents.findIndex(
          (event) =>
            event.eventType === eventType && getFrameNumber(event.frameTime, fps) === getFrameNumber(adjustedTime, fps)
        );
        if (nextIndex >= 0) setSelectedEventIndex(nextIndex);
      } catch (err) {
        pushToast(err.message, { type: 'error', duration: 4000 });
      }
    },
    [editEventIndex, events, fps, pauseAll, pushToast, persistEvents]
  );

  const openChangeEventPicker = useCallback(
    (eventIndex) => {
      const index = typeof eventIndex === 'number' ? eventIndex : resolveSelectedEventIndex();
      if (index < 0) return;
      pauseAll();
      setSelectedEventIndex(index);
      setEditEventIndex(index);
      setEventPickerMode('change');
      setShowEventPicker(true);
    },
    [pauseAll, resolveSelectedEventIndex]
  );

  const deleteSelectedEvent = useCallback(
    async (eventIndex) => {
      const index = typeof eventIndex === 'number' ? eventIndex : resolveSelectedEventIndex();
      if (index < 0) return;
      const newEvents = events.filter((_, i) => i !== index);
      setEvents(newEvents);
      setSelectedEventIndex(null);
      try {
        await persistEvents(newEvents, 'Event removed — saved');
      } catch (err) {
        pushToast(err.message, { type: 'error', duration: 4000 });
      }
    },
    [events, pushToast, resolveSelectedEventIndex, persistEvents]
  );

  const handleEventPickerSelect = useCallback(
    (eventType) => {
      if (eventPickerMode === 'change') {
        changeEventType(eventType);
      } else {
        markEvent(eventType);
      }
    },
    [eventPickerMode, changeEventType, markEvent]
  );

  const selectEvent = useCallback(
    (index, time) => {
      setSelectedEventIndex(index);
      pauseAll();
      seekTo(time);
    },
    [pauseAll, seekTo]
  );

  const save = useCallback(
    async (status = 'draft') => {
      if (isPracticeMode) {
        if (status === 'submitted') return;
        savePracticeLabels(practiceVideoUrl, events);
        setSpacingIssueIndices(new Set());
        pushToast('Practice labels saved in your browser');
        return;
      }

      if (
        status === 'submitted' &&
        labellerMode &&
        assignment?.kind !== 'tutorial'
      ) {
        const validation = validateSubmissionLabeling(events, fps);
        if (!validation.valid) {
          reportSpacingValidationFailure(
            validation,
            validation.issues.length === 1
              ? 'Fix this labeling rule before submitting'
              : `Fix ${validation.issues.length} labeling rules before submitting (listed below)`
          );
          return;
        }
      }

      setSaving(true);
      setError('');
      try {
        const data = await api.saveLabels(id, { events, status });
        setSpacingIssueIndices(new Set());
        setSpacingIssues([]);
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
        if (
          (err.code === 'LABELING_VALIDATION_INVALID' || err.code === 'EVENT_SPACING_INVALID') &&
          err.issues?.length
        ) {
          reportSpacingValidationFailure(
            {
              issues: err.issues,
              affectedIndices: err.affectedIndices || [],
            },
            err.message
          );
        } else {
          pushToast(err.message, { type: 'error', duration: 4000 });
        }
      } finally {
        setSaving(false);
      }
    },
    [
      id,
      events,
      fps,
      assignment,
      labellerMode,
      submissionStatus,
      refreshUser,
      navigate,
      pushToast,
      reportSpacingValidationFailure,
      isPracticeMode,
      practiceVideoUrl,
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

  const removeEvent = async (index) => {
    const newEvents = events.filter((_, i) => i !== index);
    setEvents(newEvents);
    try {
      await persistEvents(newEvents, 'Event removed — saved');
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
      await persistEvents(
        newEvents,
        flagged ? 'Event flagged for discussion — saved' : 'Discussion flag removed — saved'
      );
      if (flagged) {
        discussionNotesRef.current[index] = newEvents[index].notes || '';
      } else {
        delete discussionNotesRef.current[index];
      }
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
      await persistEvents(snapshot, 'Discussion note saved');
      discussionNotesRef.current[index] = next;
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
        await persistEvents(
          newEvents,
          `Moved ${target.eventType} to frame ${toDisplayFrame(getFrameNumber(newFrameTime, fps))} — saved`
        );
      } catch (err) {
        pushToast(err.message, { type: 'error', duration: 4000 });
      }
    },
    [events, fps, pauseAll, seekTo, pushToast, persistEvents]
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

  useEffect(() => {
    const tutorialLabeller = labellerMode && assignment?.kind === 'tutorial';
    const submissionLocked =
      submissionStatus === 'approved' ||
      (submissionStatus === 'rejected' && !assignment?.allowLabellerReference);

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
      if (!tutorialLabeller && !submissionLocked && (key === 'm' || key === 'M' || key === 'Enter')) {
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
        return;
      }
      if (!tutorialLabeller && !submissionLocked) {
        if (key === 'Delete') {
          const selectedIndex = resolveSelectedEventIndex();
          if (selectedIndex >= 0) {
            event.preventDefault();
            deleteSelectedEvent();
            return;
          }
        }
        if (key === 'Insert') {
          const selectedIndex = resolveSelectedEventIndex();
          if (selectedIndex >= 0) {
            event.preventDefault();
            openChangeEventPicker(selectedIndex);
            return;
          }
        }
      }
      const nudgeDelta = getNumpadFrameNudgeDelta(event);
      if (!tutorialLabeller && !submissionLocked && nudgeDelta != null) {
        event.preventDefault();
        nudgeEventAtFrame(nudgeDelta);
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
    nudgeEventAtFrame,
    resolveSelectedEventIndex,
    deleteSelectedEvent,
    openChangeEventPicker,
    labellerMode,
    assignment?.kind,
    assignment?.allowLabellerReference,
    submissionStatus,
  ]);

  const handleExport = async (variant) => {
    if (isPracticeMode) {
      const validation = validateSubmissionLabeling(events, fps);
      if (!validation.valid) {
        reportSpacingValidationFailure(
          validation,
          'Fix labeling rule violations before exporting practice labels'
        );
        return;
      }
      downloadAnnotationExport(events, {
        clipId: assignment?.clipId || 'practice',
        variant,
        fps,
      });
      pushToast(`Downloaded ${getExportFilename(resolveExportBasename(assignment) || assignment?.clipId || 'practice', variant)}`);
      return;
    }
    try {
      await api.exportLabels(id, variant, resolveExportBasename(assignment) || assignment?.clipId);
    } catch (err) {
      pushToast(err.message, { type: 'error', duration: 4000 });
    }
  };

  const resetLabelsToReference = async () => {
    const refCount = reference?.events?.length || reference?.annotationCount || 0;
    const message =
      events.length > 0
        ? `Replace your ${events.length} event(s) with ${refCount} reference event(s)? Your current labels will be lost.`
        : `Load ${refCount} reference event(s) as your starting labels?`;

    if (!window.confirm(message)) return;

    setSaving(true);
    try {
      const data = await api.resetLabelsFromReference(id);
      const nextEvents = data.events || [];
      setEvents(nextEvents);
      setSubmissionStatus(data.submission?.status || 'draft');
      setAssignment((prev) => (prev ? { ...prev, status: 'in_progress' } : prev));
      pushToast(`Reset to reference — ${nextEvents.length} event(s) saved as draft`);
    } catch (err) {
      pushToast(err.message, { type: 'error', duration: 4000 });
    } finally {
      setSaving(false);
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
  const isPractice = isPracticeMode || assignment?.kind === 'practice';
  const tutorialLabellerMode = labellerMode && isTutorial;
  const showTutorialEditor = adminMode && isTutorial;
  const showTutorialGuide = tutorialLabellerMode;
  const referenceEvents = reference?.hasReference ? reference.events : [];
  const approvedReviewMode = labellerMode && submissionStatus === 'approved';
  const submissionHadCorrections =
    approvedReviewMode &&
    (submissionReview?.correctedAt ||
      (submissionReview?.correctionBreakdown?.totalCorrections ?? 0) > 0);
  const showReference =
    reference?.hasReference &&
    (adminMode ||
      (labellerMode &&
        (assignment?.allowLabellerReference || approvedReviewMode || assignment?.status === 'approved')));
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
  const eventSearchActive = Boolean(eventSearchQuery.trim());
  const eventSearchMatchCount = countEventSearchMatches(eventSearchQuery, events);
  const visibleEventEntries = eventSearchActive
    ? events
        .map((ev, i) => ({ ev, i }))
        .filter(({ ev }) => matchesEventSearch(eventSearchQuery, ev.eventType))
    : events.map((ev, i) => ({ ev, i }));

  const asideHeight = useSyncElementHeight(
    videoDisplayRef,
    Boolean(assignment) && !isTutorial && !tutorialLabellerMode
  );

  const videoChrome = (
    <>
      <div className="video-controls">
        <div className="video-controls-row">
          <span className="time-display">{formatTime(currentTime)}</span>
          <span className="frame-display">Frame {toDisplayFrame(currentFrame)}</span>
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
          onChangeSubmissionEventType={openChangeEventPicker}
          onDeleteSubmissionEvent={deleteSelectedEvent}
          onNudgeSubmissionEvent={nudgeEventAtFrame}
          selectedSubmissionIndex={selectedEventIndex}
          onSelectSubmissionEvent={setSelectedEventIndex}
          saving={saving}
        />
      )}
    </>
  );

  if (loading) return <div className="loading">Loading labeler...</div>;
  if (error && !assignment) {
    return (
      <div>
        <div className="alert alert-error">{error}</div>
        {labellerMode && (
          <Link to={isPracticeMode ? '/assignments' : '/tutorials'} className="btn btn-secondary btn-sm">
            Back to {isPracticeMode ? 'assignments' : 'tutorials'}
          </Link>
        )}
      </div>
    );
  }

  const backTo = adminMode
    ? '/admin/videos'
    : isPractice
      ? '/assignments'
      : isTutorial
      ? '/tutorials'
      : assignment?.kind === 'pretest'
        ? '/labeling-test'
        : '/assignments';

  const backLabel = adminMode
    ? 'videos'
    : isPractice
      ? 'assignments'
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
        {showReference && labellerMode && !adminMode && canAdjustEvents && (
          <p style={{ fontSize: '0.85rem', color: '#fbbf24' }}>
            Reference visible — compare gold-standard events (blue) with your labels (green).
            {events.length === 0
              ? ' Your draft starts from reference when you have no labels yet.'
              : ' Your saved labels are kept — adjust with nudge or mark controls,'}{' '}
            then {relabelMode || pendingReviewResubmit ? 're-submit' : 'submit'} when ready.
          </p>
        )}
        {approvedReviewMode && (
          <div className="labeling-approved-review-banner">
            <p>
              <strong>Approved — read-only review.</strong> Compare your final labels (green) with
              reference events (blue). A reviewer may have adjusted events before approval — study
              the differences to improve future tasks.
            </p>
            {submissionReview?.reviewPoints != null && (
              <p className="labeling-approved-review-meta">
                Score: <strong>{submissionReview.reviewPoints}</strong>/100
                {submissionReview.reviewerNotes ? ` — ${submissionReview.reviewerNotes}` : ''}
              </p>
            )}
            {submissionHadCorrections && (
              <p className="labeling-approved-review-meta">
                Events were updated before approval (you submitted{' '}
                {submissionReview.originalEvents.length}, approved version has {events.length}).
              </p>
            )}
            <p className="labeling-approved-review-meta">
              <Link to="/labeling-guide">Open labeling guide →</Link>
            </p>
          </div>
        )}
        {pendingReviewResubmit && (
          <p style={{ fontSize: '0.85rem', color: '#93c5fd' }}>
            Already submitted — you can still edit events and <strong>Re-submit</strong> until a
            validator reviews this task.
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
          {isPractice && (
            <>
              {' '}
              · <strong>Free practice</strong> — labels are saved in your browser only; export JSON when
              done. No submission or admin approval required.
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

        <div className={`labeling-layout video-workspace-row${!isTutorial ? ' has-workspace-aside' : ''}${isTutorial ? ' labeling-layout--tutorial' : ''}`}>
        <div
          className={!isTutorial ? 'video-workspace-top' : undefined}
          style={isTutorial ? { display: 'contents' } : undefined}
        >
        <div
          className={isTutorial ? 'video-workspace-main' : 'video-workspace-display'}
          ref={isTutorial ? null : videoDisplayRef}
        >
        <div className={`video-panel${!isTutorial ? ' video-panel--display' : ''}`}>
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
              src={playbackVideoUrl}
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
          {isTutorial && videoChrome}
        </div>
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
        <div
          className="events-panel events-panel--labeling video-workspace-aside"
          style={asideHeight ? { height: asideHeight, maxHeight: asideHeight } : undefined}
        >
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

            {showReference && labellerMode && !adminMode && canAdjustEvents && (
              <div className="labeling-reset-reference-row">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={resetLabelsToReference}
                  disabled={saving}
                >
                  Reset labels to reference
                </button>
                <p className="labeling-reset-reference-hint">
                  Replace your current events with the shared reference template, then adjust and
                  submit.
                </p>
              </div>
            )}

            <section className="events-panel-add-event">
              <div className="events-panel-add-event-header">
                <h3>{canAdjustEvents ? 'Add event' : 'Your events (read-only)'}</h3>
                <button
                  type="button"
                  className="labeling-help-trigger"
                  onClick={() => setShowLabelingHelp(true)}
                  aria-label="Open labeling guide"
                  title="Labeling guide"
                >
                  ?
                </button>
              </div>
              {canAdjustEvents ? (
              <div className="mark-panel mark-panel--compact">
                <button type="button" className="btn btn-primary btn-sm" onClick={openEventPicker}>
                  Mark event at {formatTime(currentTime)}
                </button>
                {lastEvent && (
                  <p className="mark-hint last-event">
                    Last: {lastEvent.eventType} at {formatTime(lastEvent.frameTime)}
                  </p>
                )}
              </div>
              ) : (
                <p className="mark-hint" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Playback and timeline only — select events below to jump to frames.
                </p>
              )}
            </section>
          </div>

          <div className="events-panel-body">
          <div className="events-panel-scroll video-workspace-aside-events">
            {!tutorialLabellerMode && events.length > 0 && (
              <div className="events-panel-search events-panel-search--inline">
                <div className="video-workspace-aside-title">Find events</div>
                <EventSearchInput
                  value={eventSearchQuery}
                  onChange={setEventSearchQuery}
                  matchCount={eventSearchMatchCount}
                  totalCount={events.length}
                />
                {eventSearchActive && (
                  <p className="event-search-shortlist-hint">
                    Showing {eventSearchMatchCount} matching event
                    {eventSearchMatchCount !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}
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
            {spacingIssues.length > 0 && (
              <div className="labeling-spacing-alert" role="alert">
                <strong>
                  {spacingIssues.length === 1
                    ? '1 labeling rule to fix before submit'
                    : `${spacingIssues.length} labeling rules to fix before submit`}
                </strong>
                <p className="labeling-spacing-alert-summary">
                  Critical, Very bad, and Bad block submit. Recommended and Suspicious are warnings.
                  {' '}
                  {getEventSpacingRuleSummary()} {getEventPairTimingRuleSummary()}
                </p>
                <ol className="labeling-spacing-issue-list">
                  {spacingIssues.map((issue, index) => {
                    const targetIndex = issue.events?.[0]?.index;
                    return (
                      <li key={`${issue.kind}-${issue.frame ?? issue.frameA}-${index}`}>
                        <button
                          type="button"
                          className={`labeling-spacing-issue-btn${
                            issue.severity === 'critical' || issue.severity === 'very_bad'
                              ? ' labeling-spacing-issue-btn--critical'
                              : issue.severity === 'bad'
                                ? ' labeling-spacing-issue-btn--bad'
                                : issue.severity === 'recommended' || issue.severity === 'suspicious'
                                  ? ' labeling-spacing-issue-btn--warning'
                                  : ''
                          }`}
                          onClick={() => {
                            if (targetIndex != null && events[targetIndex]) {
                              selectEvent(targetIndex, events[targetIndex].frameTime);
                            }
                          }}
                        >
                          {issue.category ? `[${issue.category}] ` : ''}
                          {issue.message}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
            {spacingIssues.length === 0 && spacingIssueIndices.size > 0 && (
              <div className="labeling-spacing-alert" role="alert">
                <strong>Labeling rules not met.</strong> {getEventSpacingRuleSummary()}{' '}
                {getEventPairTimingRuleSummary()} Fix the highlighted events before submitting.
              </div>
            )}
            <div className="events-list events-list--labeling">
              {events.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No events marked yet</p>
              ) : visibleEventEntries.length === 0 ? (
                <p className="event-search-empty">
                  No events match &ldquo;{eventSearchQuery.trim()}&rdquo;
                </p>
              ) : (
                visibleEventEntries.map(({ ev, i }) => {
                  const isActive = getFrameNumber(ev.frameTime, fps) === currentFrame;
                  const isSelected = selectedEventIndex === i;
                  const hasSpacingError = spacingIssueIndices.has(i);
                  return (
                  <div
                    key={`${ev.eventType}-${ev.frameTime}-${i}`}
                    ref={isActive ? activeEventRef : null}
                    className={`event-row-wrap${isActive ? ' active' : ''}${isSelected ? ' selected' : ''}${ev.needsDiscussion ? ' needs-discussion' : ''}${hasSpacingError ? ' spacing-error' : ''}${eventSearchActive ? ' event-search-match' : ''}`}
                  >
                    <div
                      className={`event-row${isActive ? ' active' : ''}${isSelected ? ' selected' : ''}${ev.needsDiscussion ? ' needs-discussion' : ''}${hasSpacingError ? ' spacing-error' : ''}`}
                      onClick={() => selectEvent(i, ev.frameTime)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          selectEvent(i, ev.frameTime);
                        }
                      }}
                    >
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
                      <div className="event-row-actions">
                        <button
                          type="button"
                          className="event-row-icon-btn"
                          title="Go to frame"
                          aria-label="Go to frame"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectEvent(i, ev.frameTime);
                          }}
                        >
                          <span className="event-row-icon-btn-symbol" aria-hidden>
                            ▶
                          </span>
                        </button>
                        {canAdjustEvents && (
                        <button
                          type="button"
                          className="event-row-icon-btn event-row-icon-btn-danger"
                          title="Remove event"
                          aria-label="Remove event"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEventIndex(i);
                            removeEvent(i);
                          }}
                        >
                          <span className="event-row-icon-btn-symbol" aria-hidden>
                            ×
                          </span>
                        </button>
                        )}
                        {canAdjustEvents && (
                          <EventDiscussionFlag
                            iconOnly
                            flagged={Boolean(ev.needsDiscussion)}
                            disabled={saving}
                            onToggle={() => toggleEventDiscussion(i)}
                          />
                        )}
                      </div>
                    </div>
                    {canAdjustEvents && ev.needsDiscussion && (
                      <EventDiscussionNote
                        note={ev.notes || ''}
                        disabled={saving}
                        onNoteChange={(value) => updateEventDiscussionNote(i, value)}
                        onNoteBlur={() => saveEventDiscussionNote(i)}
                      />
                    )}
                    {canAdjustEvents && isActive && (
                      <FrameNudgeRow disabled={saving} onNudge={(delta) => nudgeEvent(i, delta)} />
                    )}
                  </div>
                  );
                })
              )}
            </div>
          </div>
          </div>

          <div className="events-panel-footer">
            <div className="actions-row">
              {(assignment?.clipId || isPractice) && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleExport('post')}
                    title={`Download ${getExportFilename(assignment?.clipId || 'practice', 'post')}`}
                  >
                    Export .json
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleExport('raw')}
                    title={`Download ${getExportFilename(assignment?.clipId || 'practice', 'raw')}`}
                  >
                    Export _post.json
                  </button>
                </>
              )}
              {isPractice && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={checkSpacingRules}
                    disabled={events.length === 0}
                  >
                    Check spacing rules
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      if (!window.confirm('Clear all practice labels for this video?')) return;
                      clearPracticeLabels(practiceVideoUrl);
                      setEvents([]);
                      setSpacingIssueIndices(new Set());
                      pushToast('Practice labels cleared');
                    }}
                    disabled={events.length === 0}
                  >
                    Clear labels
                  </button>
                </>
              )}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => save('draft')} disabled={saving || submissionLocked}>
                {isPractice ? 'Save locally' : 'Save draft'}
              </button>
              {labellerMode && canAdjustEvents && !isPractice && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => save('submitted')}
                  disabled={saving || events.length === 0}
                >
                  {pendingReviewResubmit || relabelMode ? 'Re-submit' : 'Submit'}
                </button>
              )}
              {submissionLocked && !approvedReviewMode && (
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

        {!isTutorial && (
          <div className="video-workspace-chrome">{videoChrome}</div>
        )}
        </div>
      </div>

      <EventPickerModal
        open={showEventPicker}
        eventTypes={eventTypes}
        lastEvent={lastEvent}
        currentTime={currentTime}
        onSelect={handleEventPickerSelect}
        onClose={() => {
          setShowEventPicker(false);
          setEventPickerMode('add');
          setEditEventIndex(null);
        }}
        title={
          eventPickerMode === 'change' && editEventIndex != null
            ? `Change ${events[editEventIndex]?.eventType || 'event'} type`
            : undefined
        }
        subtitle={
          eventPickerMode === 'change'
            ? 'Pick the new event type. Esc to cancel.'
            : undefined
        }
      />

      <LabelingHelpModal open={showLabelingHelp} onClose={() => setShowLabelingHelp(false)} />

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
