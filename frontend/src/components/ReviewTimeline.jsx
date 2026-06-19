import { useMemo } from 'react';

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
  const playheadPercent = toPercent(currentTime, maxTime);

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
    const count = 5;
    return Array.from({ length: count + 1 }, (_, i) => ({
      time: (maxTime / count) * i,
      percent: (i / count) * 100,
    }));
  }, [maxTime]);

  const seekFromLane = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(ratio * maxTime);
  };

  const primarySubmission = submissionOnFrame[0];
  const primaryRow = primarySubmission
    ? eventRowsByIndex.get(primarySubmission.index)
    : null;

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
      </div>

      <div className="review-timeline-shell">
        <div className="review-timeline-labels">
          <div className="review-timeline-label review-timeline-label-ruler" />
          <div className="review-timeline-label review-timeline-label-submission" title={labellerName}>
            {labellerName}
          </div>
          <div className="review-timeline-label review-timeline-label-reference">Reference</div>
        </div>

        <div className="review-timeline-lanes">
          <div className="review-timeline-ruler">
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

      <div className="review-frame-panel">
        <div className="review-frame-panel-title">Current frame</div>
        <div className="review-frame-compare">
          <div className="review-frame-card review-frame-card-submission">
            <span className="review-frame-card-label">Submitter</span>
            {primarySubmission ? (
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
                {canEditSubmission && (
                  <div className="review-frame-actions review-frame-actions-submission">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={onChangeSubmissionEventType}
                      disabled={saving}
                    >
                      Change type
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onNudgeSubmissionEvent?.(-1)}
                      disabled={saving}
                    >
                      −1f
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onNudgeSubmissionEvent?.(1)}
                      disabled={saving}
                    >
                      +1f
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onNudgeSubmissionEvent?.(-5)}
                      disabled={saving}
                    >
                      −5f
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onNudgeSubmissionEvent?.(5)}
                      disabled={saving}
                    >
                      +5f
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={onDeleteSubmissionEvent}
                      disabled={saving}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </>
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
