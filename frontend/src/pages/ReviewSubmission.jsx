import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { canAccessReview } from '../utils/roles';
import { FPS, applyFrameOffset, getImmediateFollowUpRule, resolveFrameOffset } from '../config/frameOffsets';
import FrameMagnifier from '../components/FrameMagnifier';
import ReviewTimeline from '../components/ReviewTimeline';
import ExportSubmissionButtons from '../components/ExportSubmissionButtons';
import CompareIssuesPanel from '../components/CompareIssuesPanel';
import DiscussionEventsPanel, { getDiscussionEvents } from '../components/DiscussionEventsPanel';
import SubmissionEventsListPanel from '../components/SubmissionEventsListPanel';
import EventPickerModal from '../components/EventPickerModal';
import { isEditableTarget, getNumpadFrameNudgeDelta } from '../config/labelingHotkeys';
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
  snapTimeToFrame,
  nudgeFrameTime,
} from '../utils/reviewPlayback';
import { formatEventTime } from '../utils/frameTime';

const FRAME_PLAY_INTERVAL_MS = 500;

function formatTime(seconds, fps = FPS) {
  return formatEventTime(seconds, fps);
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
  const [editableSubmissionEvents, setEditableSubmissionEvents] = useState([]);
  const [submissionDirty, setSubmissionDirty] = useState(false);
  const [showSubmissionEventPicker, setShowSubmissionEventPicker] = useState(false);
  const [submissionPickerMode, setSubmissionPickerMode] = useState('add');
  const [submissionEditIndex, setSubmissionEditIndex] = useState(null);
  const [selectedSubmissionIndex, setSelectedSubmissionIndex] = useState(null);
  const [savingSubmission, setSavingSubmission] = useState(false);

  const assignment = reviewData?.assignment;
  const submission = reviewData?.submission;
  const eventRows = reviewData?.eventRows || [];
  const reference = reviewData?.reference;
  const comparison = reviewData?.comparison;

  const fps = assignment?.fps || FPS;
  const frameDuration = 1 / fps;
  const maxTime = resolvePlaybackDuration(mediaDuration, assignment?.durationSeconds);
  const currentFrame = getFrameNumber(currentTime, fps);
  const isPaused = playMode === 'paused' || playMode === 'frame-auto';

  const canEditSubmission = canEditReference && !isPreview;
  const submissionEvents = canEditSubmission
    ? editableSubmissionEvents
    : submission?.events || [];
  const referenceEvents = canEditReference
    ? editableReferenceEvents
    : reference?.hasReference
      ? reference.events
      : [];

  const lastReferenceEvent = useMemo(() => {
    if (!referenceEvents.length) return null;
    return [...referenceEvents].sort((a, b) => a.frameTime - b.frameTime).at(-1);
  }, [referenceEvents]);

  const lastSubmissionEvent = useMemo(() => {
    if (!submissionEvents.length) return null;
    return [...submissionEvents].sort((a, b) => a.frameTime - b.frameTime).at(-1);
  }, [submissionEvents]);

  const eventFrames = useMemo(
    () => buildSortedEventFrames(submissionEvents, referenceEvents, fps),
    [submissionEvents, referenceEvents, fps]
  );

  const discussionEvents = useMemo(
    () => getDiscussionEvents(submissionEvents),
    [submissionEvents]
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
    if (!canEditReference || referenceDirty) return;
    const events = reviewData?.reference?.events || [];
    setEditableReferenceEvents(events);
  }, [canEditReference, referenceDirty, reviewData?.reference?.events, reviewData?.reference?.annotationCount, assignment?._id]);

  useEffect(() => {
    if (!canEditSubmission || submissionDirty) return;
    const events = reviewData?.submission?.events || [];
    setEditableSubmissionEvents(events);
  }, [canEditSubmission, submissionDirty, reviewData?.submission?.events, reviewData?.submission?.updatedAt, submission?._id]);

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
      const snapped = snapTimeToFrame(time, fps);
      const clamped = Math.max(0, Math.min(maxTime, snapped));
      if (videoRef.current) {
        videoRef.current.currentTime = clamped;
        setCurrentTime(clamped);
      }
      if (clearEventPause) {
        setPausedAtEvent(false);
      }
    },
    [maxTime, fps]
  );

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

      const nextFrame = getFrameNumber(video.currentTime, fps) + 1;
      if (getTimeForFrame(nextFrame, fps) >= maxTime) {
        seekTo(maxTime);
        pauseAll();
        return;
      }

      const next = getTimeForFrame(nextFrame, fps);
      seekTo(next, { clearEventPause: false });
      if (shouldPauseAtFrame(nextFrame)) {
        pauseAtEventFrame(nextFrame);
        stopFrameAutoPlay();
      }
    }, FRAME_PLAY_INTERVAL_MS);
  }, [
    playMode,
    pauseAll,
    stopFrameAutoPlay,
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

  const openSubmissionEventPicker = useCallback(() => {
    pauseAll();
    setSubmissionPickerMode('add');
    setShowSubmissionEventPicker(true);
  }, [pauseAll]);

  const openChangeSubmissionEventPicker = useCallback(
    (eventIndex) => {
      pauseAll();
      const index = typeof eventIndex === 'number' ? eventIndex : null;
      setSubmissionEditIndex(index);
      if (index != null) setSelectedSubmissionIndex(index);
      setSubmissionPickerMode('change');
      setShowSubmissionEventPicker(true);
    },
    [pauseAll]
  );

  const resolveSelectedSubmissionIndex = useCallback(() => {
    if (selectedSubmissionIndex != null && editableSubmissionEvents[selectedSubmissionIndex]) {
      return selectedSubmissionIndex;
    }
    if (submissionEditIndex != null && editableSubmissionEvents[submissionEditIndex]) {
      return submissionEditIndex;
    }
    return editableSubmissionEvents.findIndex(
      (event) => getFrameNumber(event.frameTime, fps) === currentFrame
    );
  }, [
    selectedSubmissionIndex,
    submissionEditIndex,
    editableSubmissionEvents,
    currentFrame,
    fps,
  ]);

  const addReferenceEvent = useCallback(
    (eventType) => {
      pauseAll();
      const playheadTime = snapTimeToFrame(videoRef.current?.currentTime ?? currentTime, fps);
      const followUpRule = lastReferenceEvent
        ? getImmediateFollowUpRule(lastReferenceEvent.eventType, eventType)
        : null;
      const useFollowUp = Boolean(followUpRule);
      const options = {
        immediateFollowUp: useFollowUp,
        afterEvent: useFollowUp ? lastReferenceEvent?.eventType : null,
      };
      const adjustedTime = applyFrameOffset(playheadTime, eventType, options, fps);
      const offset = resolveFrameOffset(eventType, options);

      const newEvents = [
        ...editableReferenceEvents,
        {
          eventType,
          frameTime: adjustedTime,
          playheadTime,
          frameOffset: offset,
          immediateFollowUp: useFollowUp,
          afterEvent: useFollowUp ? lastReferenceEvent?.eventType : undefined,
        },
      ].sort((a, b) => a.frameTime - b.frameTime);

      setEditableReferenceEvents(newEvents);
      setReferenceDirty(true);
      setShowReferenceEventPicker(false);
      setMessage(`Added reference ${eventType} at ${formatTime(adjustedTime, fps)} (unsaved)`);
      setTimeout(() => setMessage(''), 2500);
    },
    [pauseAll, currentTime, lastReferenceEvent, editableReferenceEvents, fps]
  );

  const addSubmissionEvent = useCallback(
    (eventType) => {
      pauseAll();
      const playheadTime = snapTimeToFrame(videoRef.current?.currentTime ?? currentTime, fps);
      const followUpRule = lastSubmissionEvent
        ? getImmediateFollowUpRule(lastSubmissionEvent.eventType, eventType)
        : null;
      const useFollowUp = Boolean(followUpRule);
      const options = {
        immediateFollowUp: useFollowUp,
        afterEvent: useFollowUp ? lastSubmissionEvent?.eventType : null,
      };
      const adjustedTime = applyFrameOffset(playheadTime, eventType, options, fps);
      const offset = resolveFrameOffset(eventType, options);

      const newEvents = [
        ...editableSubmissionEvents,
        {
          eventType,
          frameTime: adjustedTime,
          playheadTime,
          frameOffset: offset,
          immediateFollowUp: useFollowUp,
          afterEvent: useFollowUp ? lastSubmissionEvent?.eventType : undefined,
        },
      ].sort((a, b) => a.frameTime - b.frameTime);

      setEditableSubmissionEvents(newEvents);
      setSubmissionDirty(true);
      setShowSubmissionEventPicker(false);
      setMessage(`Added submission ${eventType} at ${formatTime(adjustedTime, fps)} (unsaved)`);
      setTimeout(() => setMessage(''), 2500);
    },
    [pauseAll, currentTime, lastSubmissionEvent, editableSubmissionEvents, fps]
  );

  const changeSubmissionEventTypeAtFrame = useCallback(
    (eventType) => {
      pauseAll();
      const frame = currentFrame;
      const targetIndex = submissionEditIndex;
      let changed = false;
      let changedTime = currentTime;
      const next = editableSubmissionEvents
        .map((event, index) => {
          const matchesIndex =
            targetIndex != null
              ? index === targetIndex
              : getFrameNumber(event.frameTime, fps) === frame;
          if (!matchesIndex) return event;
          changed = true;
          const playheadTime = snapTimeToFrame(event.playheadTime ?? event.frameTime, fps);
          const followUpRule = lastSubmissionEvent
            ? getImmediateFollowUpRule(lastSubmissionEvent.eventType, eventType)
            : null;
          const useFollowUp = Boolean(followUpRule);
          const options = {
            immediateFollowUp: useFollowUp,
            afterEvent: useFollowUp ? lastSubmissionEvent?.eventType : null,
          };
          const adjustedTime = applyFrameOffset(playheadTime, eventType, options, fps);
          const offset = resolveFrameOffset(eventType, options);
          changedTime = adjustedTime;
          return {
            ...event,
            eventType,
            frameTime: adjustedTime,
            playheadTime,
            frameOffset: offset,
            immediateFollowUp: useFollowUp,
            afterEvent: useFollowUp ? lastSubmissionEvent?.eventType : undefined,
          };
        })
        .sort((a, b) => a.frameTime - b.frameTime);

      if (!changed) {
        setShowSubmissionEventPicker(false);
        setSubmissionEditIndex(null);
        return;
      }

      setEditableSubmissionEvents(next);
      setSubmissionDirty(true);
      setShowSubmissionEventPicker(false);
      setSubmissionEditIndex(null);
      setMessage(`Changed to ${eventType} at ${formatTime(changedTime, fps)} (unsaved)`);
      setTimeout(() => setMessage(''), 2500);
    },
    [pauseAll, currentTime, fps, lastSubmissionEvent, editableSubmissionEvents, submissionEditIndex]
  );

  const handleSubmissionEventSelect = useCallback(
    (eventType) => {
      if (submissionPickerMode === 'change') {
        changeSubmissionEventTypeAtFrame(eventType);
      } else {
        addSubmissionEvent(eventType);
      }
    },
    [submissionPickerMode, changeSubmissionEventTypeAtFrame, addSubmissionEvent]
  );

  const deleteSubmissionEventAtFrame = useCallback(
    (eventIndex) => {
      const frame = currentFrame;
      const next =
        typeof eventIndex === 'number'
          ? editableSubmissionEvents.filter((_, index) => index !== eventIndex)
          : editableSubmissionEvents.filter(
              (event) => getFrameNumber(event.frameTime, fps) !== frame
            );
      if (next.length === editableSubmissionEvents.length) return;
      setEditableSubmissionEvents(next);
      setSubmissionDirty(true);
      setMessage('Removed submission event (unsaved)');
      setTimeout(() => setMessage(''), 2000);
    },
    [currentTime, fps, editableSubmissionEvents]
  );

  const nudgeSubmissionEventAtFrame = useCallback(
    (frameDelta, eventIndex) => {
      const frame = currentFrame;
      let changed = false;
      const next = editableSubmissionEvents
        .map((event, index) => {
          const matchesIndex =
            typeof eventIndex === 'number'
              ? index === eventIndex
              : getFrameNumber(event.frameTime, fps) === frame;
          if (!matchesIndex) return event;
          changed = true;
          return {
            ...event,
            frameTime: nudgeFrameTime(event.frameTime, frameDelta, fps),
          };
        })
        .sort((a, b) => a.frameTime - b.frameTime);
      if (!changed) return;
      setEditableSubmissionEvents(next);
      setSubmissionDirty(true);
    },
    [currentFrame, fps, editableSubmissionEvents]
  );

  const saveSubmissionEvents = async () => {
    if (!submissionId) return;
    setSavingSubmission(true);
    setError('');
    try {
      const data = await api.updateReviewSubmissionEvents(submissionId, {
        events: editableSubmissionEvents,
      });
      setReviewData(data);
      setEditableSubmissionEvents(data.submission?.events || editableSubmissionEvents);
      setSubmissionDirty(false);
      if (data.submission?.autoScore != null) {
        setReviewPoints(data.submission.reviewPoints || data.submission.autoScore);
      }
      setMessage(
        reference?.hasReference
          ? 'Submission corrections saved'
          : 'Submission saved — score updated from corrections'
      );
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSubmission(false);
    }
  };

  const deleteReferenceEventAtFrame = useCallback(() => {
    const frame = currentFrame;
    const next = editableReferenceEvents.filter(
      (event) => getFrameNumber(event.frameTime, fps) !== frame
    );
    if (next.length === editableReferenceEvents.length) return;
    setEditableReferenceEvents(next);
    setReferenceDirty(true);
    setMessage('Removed reference event on this frame (unsaved)');
    setTimeout(() => setMessage(''), 2000);
  }, [currentFrame, fps, editableReferenceEvents]);

  const nudgeReferenceEventAtFrame = useCallback(
    (frameDelta) => {
      const frame = currentFrame;
      let changed = false;
      const next = editableReferenceEvents
        .map((event) => {
          if (getFrameNumber(event.frameTime, fps) !== frame) return event;
          changed = true;
          return {
            ...event,
            frameTime: nudgeFrameTime(event.frameTime, frameDelta, fps),
          };
        })
        .sort((a, b) => a.frameTime - b.frameTime);
      if (!changed) return;
      setEditableReferenceEvents(next);
      setReferenceDirty(true);
    },
    [currentFrame, fps, editableReferenceEvents]
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

  const sendBackForRelabel = async (clearEvents = false) => {
    if (!submissionId) return;
    setSaving(true);
    setError('');
    try {
      const data = await api.reopenSubmissionForRelabel(submissionId, { clearEvents });
      setReviewData((prev) => ({
        ...prev,
        assignment: data.assignment,
        submission: {
          ...prev?.submission,
          ...data.submission,
          status: data.submission.status,
        },
      }));
      setMessage(data.message || 'Sent back for re-label with reference visible');
      setTimeout(() => setMessage(''), 3000);
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
      if (showSubmissionEventPicker || showReferenceEventPicker) return;
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
          (item) => getFrameNumber(item.event.frameTime, fps) === currentFrame
        );
        if (row) {
          event.preventDefault();
          validateEvent(row.eventIndex, 'valid');
        }
      }
      if (key === 'x' || key === 'X') {
        const row = eventRows.find(
          (item) => getFrameNumber(item.event.frameTime, fps) === currentFrame
        );
        if (row) {
          event.preventDefault();
          validateEvent(row.eventIndex, 'invalid');
        }
        return;
      }
      if (canEditSubmission) {
        if (key === 'Delete') {
          const index = resolveSelectedSubmissionIndex();
          if (index >= 0) {
            event.preventDefault();
            deleteSubmissionEventAtFrame(index);
            setSelectedSubmissionIndex(null);
            return;
          }
        }
        if (key === 'Insert') {
          const index = resolveSelectedSubmissionIndex();
          if (index >= 0) {
            event.preventDefault();
            openChangeSubmissionEventPicker(index);
            return;
          }
        }
      }
      const nudgeDelta = getNumpadFrameNudgeDelta(event);
      if (nudgeDelta != null) {
        const submissionOnFrame = editableSubmissionEvents.some(
          (item) => getFrameNumber(item.frameTime, fps) === currentFrame
        );
        const referenceOnFrame = editableReferenceEvents.some(
          (item) => getFrameNumber(item.frameTime, fps) === currentFrame
        );
        if (canEditSubmission && submissionOnFrame) {
          event.preventDefault();
          nudgeSubmissionEventAtFrame(nudgeDelta);
        } else if (canEditReference && referenceOnFrame) {
          event.preventDefault();
          nudgeReferenceEventAtFrame(nudgeDelta);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    stepFrames,
    togglePlayPause,
    toggleFrameAutoPlay,
    eventRows,
    currentFrame,
    fps,
    validateEvent,
    canEditSubmission,
    canEditReference,
    editableSubmissionEvents,
    editableReferenceEvents,
    nudgeSubmissionEventAtFrame,
    nudgeReferenceEventAtFrame,
    resolveSelectedSubmissionIndex,
    deleteSubmissionEventAtFrame,
    openChangeSubmissionEventPicker,
    showSubmissionEventPicker,
    showReferenceEventPicker,
  ]);

  if (loading) return <div className="loading">Loading review...</div>;
  if (error && !reviewData) return <div className="alert alert-error">{error}</div>;

  const taskPrice = effectiveTaskPrice(assignment, assignment?.taskPrice);
  const earnings = calcTaskEarnings(reviewPoints, taskPrice, ratePerPoint, assignment?.kind);
  const maxPayout = calcTaskEarnings(100, taskPrice, ratePerPoint, assignment?.kind);
  const autoScore = reviewData?.autoScore ?? submission?.autoScore;
  const autoScoreBreakdown = reviewData?.autoScoreBreakdown ?? submission?.autoScoreBreakdown;
  const correctionBreakdown = reviewData?.correctionBreakdown ?? submission?.correctionBreakdown;
  const validatedCount = eventRows.filter((row) => row.validation.status !== 'pending').length;
  const hasUnsavedEdits = referenceDirty || submissionDirty;
  const canSendBackForRelabel =
    !isPreview &&
    canEditReference &&
    reference?.hasReference &&
    assignment?.kind !== 'tutorial' &&
    assignment?.kind !== 'pretest' &&
    ['submitted', 'rejected', 'approved'].includes(submission?.status);
  const scoreLabel = reference?.hasReference
    ? 'Auto score (reference comparison)'
    : 'Correction score (manual review)';

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
            · {submissionEvents.length} events · Validated {validatedCount}/{eventRows.length}{' '}
            {discussionEvents.length > 0 && (
              <>
                · <strong>{discussionEvents.length}</strong> flagged for discussion{' '}
              </>
            )}
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
            {scoreLabel}: <strong>{autoScore}/100</strong>
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
                  Use {reference?.hasReference ? 'auto' : 'correction'} score
                </button>
              </>
            )}
          </p>
        )}
        {correctionBreakdown?.totalCorrections > 0 && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Validator corrections: {correctionBreakdown.frameAdjustments} frame adjustment
            {correctionBreakdown.frameAdjustments !== 1 ? 's' : ''}, {correctionBreakdown.missedAdded}{' '}
            missed added, {correctionBreakdown.wrongRemoved} wrong removed
          </p>
        )}
        {reference?.hasReference && comparison?.summary && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Reference: {referenceEvents.length || reference.annotationCount} events · Matched {comparison.summary.matchedCount} ·
            Missing {comparison.summary.missingCount} · Extra {comparison.summary.extraCount}
            {(comparison.matched || []).filter((item) => (item.frameDiff ?? 0) >= 2).length > 0 && (
              <>
                {' '}
                ·{' '}
                <strong style={{ color: '#fb923c' }}>
                  {(comparison.matched || []).filter((item) => (item.frameDiff ?? 0) >= 2).length}{' '}
                  ≥2f off
                </strong>
              </>
            )}
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
            No reference — review the submitter&apos;s events, correct them on the timeline, then save
            submission. Score reflects frame adjustments, missed events added, and wrong events removed.
            {submissionDirty && (
              <>
                {' '}
                · <strong>Unsaved submission edits</strong>
              </>
            )}
            {referenceDirty && (
              <>
                {' '}
                · <strong>Unsaved reference edits</strong>
              </>
            )}
          </p>
        )}
        {canEditSubmission && reference?.hasReference && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            You can correct the labeller&apos;s submission — change event types, nudge frame positions,
            add missing events, or remove wrong ones, then <strong>Save submission</strong>.
            {submissionDirty && (
              <>
                {' '}
                · <strong>Unsaved submission edits</strong>
              </>
            )}
          </p>
        )}
        {canEditReference && reference?.hasReference && submissionDirty && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <strong>Unsaved submission edits</strong> — save before approving.
          </p>
        )}
        <Link to="/review" style={{ fontSize: '0.88rem' }}>
          ← Back to review queue
        </Link>
        {!isPreview && submission?.status === 'approved' && assignment?.clipId && canEditReference && (
          <div className="actions-row" style={{ marginTop: '0.75rem' }}>
            <ExportSubmissionButtons
              submissionId={submission._id}
              clipId={assignment.clipId}
              hasReference={reference?.hasReference}
            />
          </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="review-workspace">
        <div className={`review-video-row${!isPreview ? ' has-compare-sidebar' : ''}`}>
          <div className="video-panel review-video-panel">
            <FrameMagnifier
            videoRef={videoRef}
            currentTime={currentTime}
            isPaused={isPaused}
            enabled={magnifyEnabled}
            onEnabledChange={setMagnifyEnabled}
            submissionEvents={submissionEvents}
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
        </div>

          <CompareIssuesPanel
            comparison={comparison}
            onSeek={handleScrub}
            fps={fps}
            previewMode={isPreview}
          />

          {!isPreview && (
            <SubmissionEventsListPanel
              events={submissionEvents}
              eventRows={eventRows}
              currentTime={currentTime}
              fps={fps}
              onSeek={handleScrub}
              selectedIndex={selectedSubmissionIndex}
              onSelect={setSelectedSubmissionIndex}
            />
          )}

          {!isPreview && (
            <DiscussionEventsPanel events={submissionEvents} onSeek={handleScrub} fps={fps} />
          )}
        </div>

        <ReviewTimeline
            currentTime={currentTime}
            maxTime={maxTime}
            fps={fps}
            submissionEvents={submissionEvents}
            referenceEvents={referenceEvents}
            eventRows={eventRows}
            comparison={comparison}
            labellerName={isPreview ? 'No submission yet' : submission?.userId?.name || 'Submitter'}
            hasReference={reference?.hasReference || (canEditReference && referenceEvents.length > 0)}
            previewMode={isPreview}
            saving={saving || savingReference || savingSubmission}
            canEditReference={canEditReference}
            referenceDirty={referenceDirty}
            onAddReferenceEvent={openReferenceEventPicker}
            onDeleteReferenceEvent={deleteReferenceEventAtFrame}
            onNudgeReferenceEvent={nudgeReferenceEventAtFrame}
            onSaveReference={saveReferenceEvents}
            canEditSubmission={canEditSubmission}
            submissionDirty={submissionDirty}
            onAddSubmissionEvent={openSubmissionEventPicker}
            onChangeSubmissionEventType={openChangeSubmissionEventPicker}
            onDeleteSubmissionEvent={deleteSubmissionEventAtFrame}
            onNudgeSubmissionEvent={nudgeSubmissionEventAtFrame}
            onSaveSubmission={saveSubmissionEvents}
            selectedSubmissionIndex={selectedSubmissionIndex}
            onSelectSubmissionEvent={setSelectedSubmissionIndex}
            onSeek={handleScrub}
            onValidateEvent={validateEvent}
            onValidateAll={validateAll}
            onAutoValidate={autoValidateFromComparison}
          />

          {!isPreview && submission?.status === 'submitted' && (
            <div className="review-final-bar">
              {!reference?.hasReference && autoScore == null && (
                <p className="alert alert-info" style={{ marginBottom: '1rem' }}>
                  No reference for this clip — correct the submitter&apos;s events and save submission to
                  compute a correction score.
                </p>
              )}
              {autoScoreBreakdown?.length > 0 && (
                <div className="labeling-score-breakdown" style={{ marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    {reference?.hasReference ? 'Auto score breakdown' : 'Correction score breakdown'}
                  </h4>
                  {autoScoreBreakdown.map((item) => (
                    <div
                      key={`${item.eventType}-${item.referenceIndex}`}
                      className={`labeling-score-row${(item.frameDiff ?? 0) >= 2 ? ' score-row-off' : ''}`}
                    >
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
              {hasUnsavedEdits && (
                <p className="alert alert-info" style={{ marginBottom: '1rem' }}>
                  Save submission or reference edits before approving.
                </p>
              )}
              {canSendBackForRelabel && (
                <p className="alert alert-info" style={{ marginBottom: '1rem' }}>
                  Reference was updated or criteria changed? Send the task back so the labeller can
                  compare against reference and re-label.
                </p>
              )}
              <div className="review-final-actions">
                {canSendBackForRelabel && (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => sendBackForRelabel(false)}
                      disabled={saving || hasUnsavedEdits}
                    >
                      Send back for re-label
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => sendBackForRelabel(true)}
                      disabled={saving || hasUnsavedEdits}
                      title="Clear existing labels so labeller starts fresh"
                    >
                      Send back (clear labels)
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => submitReview('rejected')}
                  disabled={saving || hasUnsavedEdits}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => submitReview('approved')}
                  disabled={saving || hasUnsavedEdits}
                >
                  Approve — {formatMoney(earnings, currency)}
                </button>
              </div>
            </div>
          )}
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
      {canEditSubmission && (
        <EventPickerModal
          open={showSubmissionEventPicker}
          eventTypes={eventTypes}
          lastEvent={lastSubmissionEvent}
          currentTime={currentTime}
          title={
            submissionPickerMode === 'change'
              ? `Change event type · frame ${currentFrame}`
              : undefined
          }
          subtitle={
            submissionPickerMode === 'change'
              ? 'Pick the corrected event type for this frame.'
              : undefined
          }
          onSelect={handleSubmissionEventSelect}
          onClose={() => setShowSubmissionEventPicker(false)}
        />
      )}
    </div>
  );
}
