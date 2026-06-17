import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import {
  applyFrameOffset,
  canImmediateFollowUp,
  formatOffset,
  frameToSeconds,
  getImmediateFollowUpRule,
  resolveFrameOffset,
} from '../config/frameOffsets';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2);
  return `${m}:${s.padStart(5, '0')}`;
}

export default function Labeling() {
  const { id } = useParams();
  const videoRef = useRef(null);
  const [assignment, setAssignment] = useState(null);
  const [eventTypes, setEventTypes] = useState([]);
  const [events, setEvents] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedType, setSelectedType] = useState('');
  const [immediateFollowUp, setImmediateFollowUp] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const lastEvent = events.length > 0 ? events[events.length - 1] : null;
  const followUpRule = useMemo(
    () => (lastEvent ? getImmediateFollowUpRule(lastEvent.eventType, selectedType) : null),
    [lastEvent, selectedType]
  );
  const showFollowUpOption = canImmediateFollowUp(selectedType) && followUpRule;

  const offsetOptions = {
    immediateFollowUp,
    afterEvent: immediateFollowUp ? lastEvent?.eventType : null,
  };
  const selectedOffset = resolveFrameOffset(selectedType, offsetOptions);
  const markedTime = applyFrameOffset(currentTime, selectedType, offsetOptions);

  useEffect(() => {
    Promise.all([api.getAssignment(id), api.getEvents(), api.getLabels(id)])
      .then(([assign, types, labels]) => {
        setAssignment(assign);
        setEventTypes(types);
        setSelectedType(types[0] || '');
        setEvents(labels.events || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setImmediateFollowUp(Boolean(followUpRule));
  }, [followUpRule?.id, selectedType]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const captureFrame = () => {
    const playheadTime = videoRef.current?.currentTime ?? currentTime;
    if (!selectedType) return;

    const options = {
      immediateFollowUp,
      afterEvent: immediateFollowUp ? lastEvent?.eventType : null,
    };
    const adjustedTime = applyFrameOffset(playheadTime, selectedType, options);
    const offset = resolveFrameOffset(selectedType, options);

    setEvents((prev) =>
      [
        ...prev,
        {
          eventType: selectedType,
          frameTime: adjustedTime,
          playheadTime: parseFloat(playheadTime.toFixed(3)),
          frameOffset: offset,
          immediateFollowUp,
          afterEvent: immediateFollowUp ? lastEvent?.eventType : undefined,
          notes,
        },
      ].sort((a, b) => a.frameTime - b.frameTime)
    );
    setNotes('');
    setImmediateFollowUp(false);
    setMessage(
      `Marked ${selectedType} at ${formatTime(adjustedTime)} (${formatOffset(offset)} frames${immediateFollowUp ? ', immediate follow-up' : ''})`
    );
    setTimeout(() => setMessage(''), 2500);
  };

  const removeEvent = (index) => {
    setEvents((prev) => prev.filter((_, i) => i !== index));
  };

  const seekTo = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const stepFrame = (direction) => {
    seekTo(Math.max(0, currentTime + frameToSeconds(direction)));
  };

  const save = async (status = 'draft') => {
    setSaving(true);
    setError('');
    try {
      await api.saveLabels(id, { events, status });
      setMessage(status === 'submitted' ? 'Submitted for review!' : 'Draft saved');
      if (status === 'submitted') {
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading">Loading labeler...</div>;
  if (error && !assignment) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      <div className="page-header">
        <h1>{assignment?.title}</h1>
        <p>{assignment?.description}</p>
        <Link to="/assignments" style={{ fontSize: '0.88rem' }}>
          ← Back to assignments
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="labeling-layout">
        <div className="video-panel">
          <video
            ref={videoRef}
            src={assignment?.videoUrl}
            onTimeUpdate={handleTimeUpdate}
            controls
          />
          <div className="video-controls">
            <span className="time-display">{formatTime(currentTime)}</span>
            <input
              type="range"
              className="frame-slider"
              min={0}
              max={assignment?.durationSeconds || 30}
              step={0.01}
              value={currentTime}
              onChange={(e) => seekTo(parseFloat(e.target.value))}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => stepFrame(-1)}>
              −1 frame
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => stepFrame(1)}>
              +1 frame
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => videoRef.current?.pause()}>
              Pause
            </button>
          </div>
        </div>

        <div className="events-panel">
          <h3>Add event</h3>
          <p className="offset-hint">
            Default: <strong>−2</strong> · Pass/Shot: <strong>−3</strong> · Goal/Ball Out: <strong>+1</strong>
            · Immediate follow-up: <strong>0</strong> at touch
          </p>
          <div className="add-event-form">
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setImmediateFollowUp(false);
              }}
            >
              {eventTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {showFollowUpOption && (
              <label className="follow-up-toggle">
                <input
                  type="checkbox"
                  checked={immediateFollowUp}
                  onChange={(e) => setImmediateFollowUp(e.target.checked)}
                />
                <span>
                  <strong>Immediate follow-up</strong> after {lastEvent.eventType}
                  <span className="follow-up-detail">{followUpRule.detail}</span>
                </span>
              </label>
            )}

            <div className="mark-preview">
              <span>Playhead: {formatTime(currentTime)}</span>
              <span>
                Will mark: <strong>{formatTime(markedTime)}</strong>
                <span className={`offset-badge inline${selectedOffset > 0 ? ' positive' : selectedOffset === 0 ? ' zero' : ''}`}>
                  {formatOffset(selectedOffset)} frames
                </span>
              </span>
            </div>
            <input
              type="text"
              placeholder="Optional notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={captureFrame}>
              Mark {selectedType} at {formatTime(markedTime)}
            </button>
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
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => seekTo(ev.frameTime)}>
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
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => save('draft')} disabled={saving}>
              Save draft
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => save('submitted')} disabled={saving || events.length === 0}>
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
