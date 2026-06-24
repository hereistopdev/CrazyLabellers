import { FPS } from '../config/frameOffsets';
import { formatEventTime, getFrameNumber } from '../utils/frameTime';

function formatTime(seconds, fps = FPS) {
  return formatEventTime(seconds, fps);
}

export function getDiscussionEvents(events = []) {
  return events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.needsDiscussion)
    .sort((a, b) => a.event.frameTime - b.event.frameTime);
}

export default function DiscussionEventsPanel({
  events = [],
  onSeek,
  fps = FPS,
  embedded = false,
  className = '',
}) {
  const flagged = getDiscussionEvents(events);
  if (!flagged.length) return null;

  const panel = (
    <div className={`review-attention-panel review-discussion-panel-inner${embedded ? ' review-discussion-embedded' : ''}`}>
      <div className="review-attention-title review-discussion-title">
        Flagged for discussion — {flagged.length} event{flagged.length !== 1 ? 's' : ''}
      </div>
      <p className="review-discussion-hint">
        Labeller marked these as uncertain and wants validator or admin input.
      </p>
      <div className="review-attention-chips review-discussion-chips">
        {flagged.map(({ event, index }) => (
          <button
            key={`discuss-${index}-${event.eventType}-${event.frameTime}`}
            type="button"
            className="review-attention-chip review-attention-chip-discussion"
            onClick={() => onSeek(event.frameTime)}
            title={event.notes || undefined}
          >
            <span className="review-discussion-chip-label">
              {event.eventType} @ {formatTime(event.frameTime, fps)} · F
              {getFrameNumber(event.frameTime, fps)}
            </span>
            {event.notes ? (
              <span className="review-discussion-chip-note">{event.notes}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );

  if (embedded) {
    return panel;
  }

  return (
    <aside className={`review-discussion-panel${className ? ` ${className}` : ''}`}>
      {panel}
    </aside>
  );
}
