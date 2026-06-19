import { useMemo, useRef, useState, useCallback, useLayoutEffect } from 'react';

const MIN_ZOOM = 1;
const MAX_ZOOM = 40;
const ZOOM_WHEEL_FACTOR = 0.14;

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1);
  return `${m}:${s.padStart(5, '0')}`;
}

function toPercent(time, maxTime) {
  if (!maxTime) return 0;
  return Math.max(0, Math.min(100, (time / maxTime) * 100));
}

function isOnFrame(eventTime, currentTime, fps) {
  return Math.round(eventTime * fps) === Math.round(currentTime * fps);
}

function comparisonLabel(status) {
  if (status === 'match') return 'Match';
  if (status === 'close') return 'Close';
  if (status === 'extra') return 'Extra';
  if (status === 'unmatched') return 'No ref';
  return null;
}

function EventMarkers({
  items,
  variant,
  currentTime,
  maxTime,
  fps,
  onSeek,
  eventRowsByIndex,
}) {
  return items.map(({ event, eventIndex }, index) => {
    const active = isOnFrame(event.frameTime, currentTime, fps);
    const row =
      variant === 'submission' && eventIndex != null
        ? eventRowsByIndex?.get(eventIndex)
        : null;
    const validationStatus = row?.validation?.status || 'pending';
    const comparisonStatus = row?.comparisonStatus;

    return (
      <button
        key={`${variant}-${event.eventType}-${event.frameTime}-${eventIndex ?? index}`}
        type="button"
        className={[
          'review-timeline-marker',
          `review-timeline-marker-${variant}`,
          active ? 'active' : '',
          variant === 'submission' ? `validation-${validationStatus}` : '',
          comparisonStatus ? `comparison-${comparisonStatus}` : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ left: `${toPercent(event.frameTime, maxTime)}%` }}
        title={`${event.eventType} @ ${formatTime(event.frameTime)}`}
        onClick={(e) => {
          e.stopPropagation();
          onSeek(event.frameTime);
        }}
      >
        <span className="review-timeline-marker-dot" />
        <span className="review-timeline-marker-label">{event.eventType}</span>
      </button>
    );
  });
}

export default function ReviewTimeline({
  currentTime,
  maxTime,
  fps,
  submissionEvents = [],
  referenceEvents = [],
  eventRows = [],
  labellerName = 'Submitter',
  onSeek,
  onValidateEvent,
  saving = false,
  hasReference = false,
  previewMode = false,
  onValidateAll,
  onAutoValidate,
  canEditReference = false,
  referenceDirty = false,
  onAddReferenceEvent,
  onDeleteReferenceEvent,
  onNudgeReferenceEvent,
  onSaveReference,
  canEditSubmission = false,
  submissionDirty = false,
  onAddSubmissionEvent,
  onChangeSubmissionEventType,
  onDeleteSubmissionEvent,
  onNudgeSubmissionEvent,
  onSaveSubmission,
}) {
  const viewportRef = useRef(null);
  const contentRef = useRef(null);
  const pendingScrollRef = useRef(null);
  const [zoom, setZoom] = useState(1);

  const playheadPercent = toPercent(currentTime, maxTime);

  const zoomAroundPlayhead = useCallback(
    (nextZoom) => {
      const viewport = viewportRef.current;
      const content = contentRef.current;
      if (!viewport || !content || !maxTime) {
        setZoom(nextZoom);
        return;
      }

      const playheadRatio = currentTime / maxTime;
      const oldContentWidth = content.offsetWidth;
      const playheadInContent = playheadRatio * oldContentWidth;
      const cursorInViewport = playheadInContent - viewport.scrollLeft;

      pendingScrollRef.current = {
        anchorRatio: playheadRatio,
        cursorInViewport: Math.max(0, Math.min(viewport.clientWidth, cursorInViewport)),
      };
      setZoom(nextZoom);
    },
    [currentTime, maxTime]
  );

  const resetZoom = useCallback(() => {
    pendingScrollRef.current = null;
    setZoom(1);
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = 0;
    }
  }, []);

  const handleTimelineWheel = useCallback(
    (e) => {
      if (!maxTime) return;
      e.preventDefault();
      e.stopPropagation();

      const viewport = viewportRef.current;
      const content = contentRef.current;
      if (!viewport || !content) return;

      const zoomIn = e.deltaY < 0;
      const multiplier = zoomIn ? 1 + ZOOM_WHEEL_FACTOR : 1 / (1 + ZOOM_WHEEL_FACTOR);
      const nextZoom = clampZoom(zoom * multiplier);
      if (nextZoom === zoom) return;

      const viewportRect = viewport.getBoundingClientRect();
      const oldContentWidth = content.offsetWidth;
      const cursorInViewport = e.clientX - viewportRect.left;
      const cursorInContent = viewport.scrollLeft + cursorInViewport;
      const anchorRatio = oldContentWidth > 0 ? cursorInContent / oldContentWidth : 0;

      pendingScrollRef.current = { anchorRatio, cursorInViewport };
      setZoom(nextZoom);
    },
    [maxTime, zoom]
  );

  useLayoutEffect(() => {
    if (!pendingScrollRef.current) return;
    const { anchorRatio, cursorInViewport } = pendingScrollRef.current;
    pendingScrollRef.current = null;

    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const maxScroll = Math.max(0, content.offsetWidth - viewport.clientWidth);
    viewport.scrollLeft = Math.max(
      0,
      Math.min(maxScroll, anchorRatio * content.offsetWidth - cursorInViewport)
    );
  }, [zoom]);

  useLayoutEffect(() => {
    if (zoom <= 1) return;
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content || !maxTime) return;

    const playheadX = (currentTime / maxTime) * content.offsetWidth;
    const left = viewport.scrollLeft;
    const right = left + viewport.clientWidth;
    const margin = 48;

    if (playheadX < left + margin) {
      viewport.scrollLeft = Math.max(0, playheadX - margin);
    } else if (playheadX > right - margin) {
      viewport.scrollLeft = Math.min(
        content.offsetWidth - viewport.clientWidth,
        playheadX - viewport.clientWidth + margin
      );
    }
  }, [currentTime, maxTime, zoom]);

  const sortedSubmission = useMemo(
    () =>
      [...submissionEvents]
        .map((event, index) => ({ event, index }))
        .sort((a, b) => a.event.frameTime - b.event.frameTime),
    [submissionEvents]
  );

  const sortedReference = useMemo(
    () => [...referenceEvents].sort((a, b) => a.frameTime - b.frameTime),
    [referenceEvents]
  );

  const eventRowsByIndex = useMemo(
    () => new Map(eventRows.map((row) => [row.eventIndex, row])),
    [eventRows]
  );

  const submissionOnFrame = useMemo(
    () => sortedSubmission.filter(({ event }) => isOnFrame(event.frameTime, currentTime, fps)),
    [sortedSubmission, currentTime, fps]
  );

  const referenceOnFrame = useMemo(
    () => sortedReference.filter((event) => isOnFrame(event.frameTime, currentTime, fps)),
    [sortedReference, currentTime, fps]
  );

  const missingOnFrame = useMemo(() => {
    if (!referenceOnFrame.length) return [];
    const submissionTypes = new Set(submissionOnFrame.map(({ event }) => event.eventType));
    return referenceOnFrame.filter((event) => {
      const matched = submissionOnFrame.some(
        ({ event: subEvent }) => subEvent.eventType === event.eventType
      );
      return !matched;
    });
  }, [referenceOnFrame, submissionOnFrame]);

  const ticks = useMemo(() => {
    if (!maxTime) return [];
    const count = Math.min(80, Math.max(5, Math.round(5 * zoom)));
    return Array.from({ length: count + 1 }, (_, i) => ({
      time: (maxTime / count) * i,
      percent: (i / count) * 100,
    }));
  }, [maxTime, zoom]);

  const seekFromLane = (e) => {
    const content = contentRef.current;
    if (!content || !maxTime) return;
    const rect = content.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    onSeek(ratio * maxTime);
  };

  const primarySubmission = submissionOnFrame[0];
  const primaryRow = primarySubmission
    ? eventRowsByIndex.get(primarySubmission.index)
    : null;

  const renderSubmissionEditActions = (eventIndex) => (
    <div className="review-frame-actions review-frame-actions-submission">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onChangeSubmissionEventType?.(eventIndex)}
        disabled={saving}
      >
        Change type
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onNudgeSubmissionEvent?.(-1, eventIndex)}
        disabled={saving}
      >
        −1f
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onNudgeSubmissionEvent?.(1, eventIndex)}
        disabled={saving}
      >
        +1f
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onNudgeSubmissionEvent?.(-5, eventIndex)}
        disabled={saving}
      >
        −5f
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onNudgeSubmissionEvent?.(5, eventIndex)}
        disabled={saving}
      >
        +5f
      </button>
      <button
        type="button"
        className="btn btn-danger btn-sm"
        onClick={() => onDeleteSubmissionEvent?.(eventIndex)}
        disabled={saving}
      >
        Delete
      </button>
    </div>
  );

  return (
    <div className="review-timeline">
      <div className="review-timeline-header">
        <span className="review-timeline-title">
          {previewMode ? 'Reference timeline' : 'Validation timeline'}
        </span>
        {!previewMode && (
        <div className="review-timeline-toolbar">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onValidateAll?.('valid')}
            disabled={saving || submissionEvents.length === 0}
          >
            Validate all
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onValidateAll?.('invalid')}
            disabled={saving || submissionEvents.length === 0}
          >
            Reject all
          </button>
          {hasReference && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onAutoValidate}
              disabled={saving}
            >
              Auto from reference
            </button>
          )}
        </div>
        )}
        {canEditReference && (
          <div className="review-timeline-toolbar review-timeline-toolbar-reference">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onAddReferenceEvent}
              disabled={saving}
            >
              Add ref event
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onSaveReference}
              disabled={saving || !referenceDirty}
            >
              Save reference
            </button>
          </div>
        )}
        {canEditSubmission && (
          <div className="review-timeline-toolbar review-timeline-toolbar-submission">
            <span className="review-timeline-edit-hint">
              Correct labeller labels: change type, nudge frames, add/remove events
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onAddSubmissionEvent}
              disabled={saving}
            >
              Add event
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onSaveSubmission}
              disabled={saving || !submissionDirty}
            >
              Save submission
            </button>
          </div>
        )}
        <span className="review-timeline-current">
          Frame {Math.round(currentTime * fps)} · {formatTime(currentTime)}
        </span>
        <div className="review-timeline-zoom-controls">
          <span className="review-timeline-zoom-hint">Scroll to zoom</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm review-timeline-zoom-btn"
            onClick={() => zoomAroundPlayhead(clampZoom(zoom / (1 + ZOOM_WHEEL_FACTOR)))}
            disabled={zoom <= MIN_ZOOM}
            title="Zoom out"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="review-timeline-zoom-level">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm review-timeline-zoom-btn"
            onClick={() => zoomAroundPlayhead(clampZoom(zoom * (1 + ZOOM_WHEEL_FACTOR)))}
            disabled={zoom >= MAX_ZOOM}
            title="Zoom in"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={resetZoom}
            disabled={zoom <= MIN_ZOOM}
            title="Reset zoom"
          >
            Fit
          </button>
        </div>
      </div>

      <div className="review-timeline-shell">
        <div className="review-timeline-labels">
          <div className="review-timeline-label review-timeline-label-ruler" />
          <div className="review-timeline-label review-timeline-label-submission" title={labellerName}>
            {labellerName}
          </div>
          <div className="review-timeline-label review-timeline-label-reference">Reference</div>
        </div>

        <div
          className="review-timeline-viewport"
          ref={viewportRef}
          onWheel={handleTimelineWheel}
        >
          <div
            className="review-timeline-lanes"
            ref={contentRef}
            style={{ width: `${zoom * 100}%` }}
          >
          <div className="review-timeline-ruler" onClick={seekFromLane} role="presentation">
            {ticks.map((tick) => (
              <span
                key={tick.time}
                className="review-timeline-tick"
                style={{ left: `${tick.percent}%` }}
              >
                {formatTime(tick.time)}
              </span>
            ))}
          </div>

          <div className="review-timeline-tracks">
            <div
              className="review-timeline-playhead"
              style={{ left: `${playheadPercent}%` }}
              aria-hidden
            />

            <div
              className="review-timeline-track-lane review-timeline-track-lane-submission"
              onClick={seekFromLane}
              role="presentation"
            >
              <EventMarkers
                items={sortedSubmission}
                variant="submission"
                currentTime={currentTime}
                maxTime={maxTime}
                fps={fps}
                onSeek={onSeek}
                eventRowsByIndex={eventRowsByIndex}
              />
            </div>

            <div
              className="review-timeline-track-lane review-timeline-track-lane-reference"
              onClick={seekFromLane}
              role="presentation"
            >
              <EventMarkers
                items={sortedReference.map((event, index) => ({ event, eventIndex: index }))}
                variant="reference"
                currentTime={currentTime}
                maxTime={maxTime}
                fps={fps}
                onSeek={onSeek}
              />
            </div>
          </div>
        </div>
        </div>
      </div>

      <div className="review-frame-panel">
        <div className="review-frame-panel-title">Current frame</div>
        <div className="review-frame-compare">
          <div className="review-frame-card review-frame-card-submission">
            <span className="review-frame-card-label">Submitter</span>
            {submissionOnFrame.length > 0 ? (
              submissionOnFrame.length === 1 ? (
                <>
                  <strong className="review-frame-event-name">{primarySubmission.event.eventType}</strong>
                  <span className="review-frame-event-time">
                    {formatTime(primarySubmission.event.frameTime)}
                  </span>
                  {primaryRow?.comparisonStatus && (
                    <span className={`comparison-badge comparison-${primaryRow.comparisonStatus}`}>
                      {comparisonLabel(primaryRow.comparisonStatus)}
                      {primaryRow.match?.timeDiffMs != null && ` ±${primaryRow.match.timeDiffMs}ms`}
                    </span>
                  )}
                  {canEditSubmission && renderSubmissionEditActions(primarySubmission.index)}
                </>
              ) : (
                <div className="review-frame-event-list">
                  {submissionOnFrame.map(({ event, index }) => {
                    const row = eventRowsByIndex.get(index);
                    return (
                      <div key={`sub-frame-${index}-${event.eventType}`} className="review-frame-event-item">
                        <strong className="review-frame-event-name">{event.eventType}</strong>
                        <span className="review-frame-event-time">
                          {formatTime(event.frameTime)}
                        </span>
                        {row?.comparisonStatus && (
                          <span className={`comparison-badge comparison-${row.comparisonStatus}`}>
                            {comparisonLabel(row.comparisonStatus)}
                          </span>
                        )}
                        {canEditSubmission && renderSubmissionEditActions(index)}
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <>
                <span className="review-frame-empty">No submitter event</span>
                {canEditSubmission && (
                  <div className="review-frame-actions review-frame-actions-submission">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={onAddSubmissionEvent}
                      disabled={saving}
                    >
                      Add event
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="review-frame-vs">vs</div>

          <div className="review-frame-card review-frame-card-reference">
            <span className="review-frame-card-label">Reference</span>
            {referenceOnFrame[0] ? (
              <>
                <strong className="review-frame-event-name">{referenceOnFrame[0].eventType}</strong>
                <span className="review-frame-event-time">
                  {formatTime(referenceOnFrame[0].frameTime)}
                </span>
              </>
            ) : (
              <span className="review-frame-empty">No reference event</span>
            )}
            {canEditReference && (
              <div className="review-frame-actions review-frame-actions-reference">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={onAddReferenceEvent}
                  disabled={saving}
                >
                  Add
                </button>
                {referenceOnFrame[0] && (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onNudgeReferenceEvent?.(-1)}
                      disabled={saving}
                    >
                      −1f
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onNudgeReferenceEvent?.(1)}
                      disabled={saving}
                    >
                      +1f
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={onDeleteReferenceEvent}
                      disabled={saving}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {primarySubmission && !previewMode && (
            <div className="review-frame-actions">
              <button
                type="button"
                className={`btn btn-sm${primaryRow?.validation?.status === 'valid' ? ' btn-primary' : ' btn-secondary'}`}
                onClick={() => onValidateEvent?.(primarySubmission.index, 'valid')}
                disabled={saving}
              >
                ✓ Valid
              </button>
              <button
                type="button"
                className={`btn btn-sm${primaryRow?.validation?.status === 'invalid' ? ' btn-danger' : ' btn-secondary'}`}
                onClick={() => onValidateEvent?.(primarySubmission.index, 'invalid')}
                disabled={saving}
              >
                ✗ Invalid
              </button>
            </div>
          )}
        </div>

        {missingOnFrame.length > 0 && (
          <div className="review-frame-missing">
            Missing from submission on this frame:
            {missingOnFrame.map((event) => (
              <button
                key={`missing-${event.eventType}-${event.frameTime}`}
                type="button"
                className="review-frame-missing-chip"
                onClick={() => onSeek(event.frameTime)}
              >
                {event.eventType} @ {formatTime(event.frameTime)}
              </button>
            ))}
          </div>
        )}

        {submissionOnFrame.length === 0 &&
          referenceOnFrame.length === 0 &&
          missingOnFrame.length === 0 && (
            <p className="review-frame-hint">
              Step through frames or click timeline markers to compare submitter and reference events.
            </p>
          )}
      </div>
    </div>
  );
}
