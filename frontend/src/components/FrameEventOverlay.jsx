import { useMemo } from 'react';

export function getEventsOnFrame(events, currentTime, fps) {
  if (!events?.length || fps <= 0) return [];

  const currentFrame = Math.round(currentTime * fps);
  return events.filter((event) => Math.round(event.frameTime * fps) === currentFrame);
}

export default function FrameEventOverlay({
  currentTime,
  fps,
  submissionEvents = [],
  referenceEvents = [],
}) {
  const submissionOnFrame = useMemo(
    () => getEventsOnFrame(submissionEvents, currentTime, fps),
    [submissionEvents, currentTime, fps]
  );

  const referenceOnFrame = useMemo(
    () => getEventsOnFrame(referenceEvents, currentTime, fps),
    [referenceEvents, currentTime, fps]
  );

  if (submissionOnFrame.length === 0 && referenceOnFrame.length === 0) {
    return null;
  }

  return (
    <div className="frame-event-overlay" aria-live="polite">
      {submissionOnFrame.length > 0 && (
        <div className="frame-event-corner frame-event-corner-left">
          {submissionOnFrame.map((event, index) => (
            <span
              key={`sub-${event.eventType}-${event.frameTime}-${index}`}
              className="frame-event-badge frame-event-badge-submission"
            >
              {event.eventType}
            </span>
          ))}
        </div>
      )}

      {referenceOnFrame.length > 0 && (
        <div className="frame-event-corner frame-event-corner-right">
          {referenceOnFrame.map((event, index) => (
            <span
              key={`ref-${event.eventType}-${event.frameTime}-${index}`}
              className="frame-event-badge frame-event-badge-reference"
            >
              {event.eventType}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
