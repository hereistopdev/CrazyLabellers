function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2);
  return `${m}:${s.padStart(5, '0')}`;
}

export default function ReferenceEventsPanel({
  referenceEvents = [],
  currentTime,
  fps,
  onSeek,
  annotationCount = 0,
}) {
  if (!referenceEvents.length) return null;

  const currentFrame = Math.round(currentTime * fps);
  const onFrame = referenceEvents.filter(
    (event) => Math.round(event.frameTime * fps) === currentFrame
  );

  return (
    <section className="reference-events-panel">
      <header className="reference-events-header">
        <div>
          <span className="reference-events-eyebrow">Reference JSON</span>
          <h3>Gold-standard events</h3>
        </div>
        <span className="reference-events-count">{annotationCount || referenceEvents.length}</span>
      </header>

      {onFrame.length > 0 && (
        <div className="reference-on-frame">
          <span className="reference-on-frame-label">On frame {currentFrame}</span>
          <div className="reference-on-frame-pills">
            {onFrame.map((event, index) => (
              <span key={`${event.eventType}-${index}`} className="reference-event-pill">
                {event.eventType}
              </span>
            ))}
          </div>
        </div>
      )}

      <ul className="reference-events-list">
        {[...referenceEvents]
          .sort((a, b) => a.frameTime - b.frameTime)
          .map((event, index) => {
            const frame = Math.round(event.frameTime * fps);
            const isActive = frame === currentFrame;
            return (
              <li key={`${event.eventType}-${event.frameTime}-${index}`} className={isActive ? 'active' : ''}>
                <button type="button" className="reference-event-row" onClick={() => onSeek(event.frameTime)}>
                  <span className="reference-event-time">{formatTime(event.frameTime)}</span>
                  <span className="reference-event-frame">F{frame}</span>
                  <span className="reference-event-name">{event.eventType}</span>
                </button>
              </li>
            );
          })}
      </ul>
    </section>
  );
}
