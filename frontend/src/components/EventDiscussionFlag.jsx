export default function EventDiscussionFlag({
  flagged = false,
  note = '',
  disabled = false,
  onToggle,
  onNoteChange,
  onNoteBlur,
}) {
  return (
    <div className={`event-discussion-flag${flagged ? ' is-flagged' : ''}`}>
      <button
        type="button"
        className={`event-discussion-toggle${flagged ? ' event-discussion-toggle-on' : ''}`}
        onClick={onToggle}
        disabled={disabled}
        title={
          flagged
            ? 'Remove flag — no longer needs discussion'
            : 'Flag this event for validator or admin discussion'
        }
        aria-pressed={flagged}
      >
        <span className="event-discussion-toggle-icon" aria-hidden>
          ⚑
        </span>
        <span>{flagged ? 'Flagged for discussion' : 'Discuss with reviewer'}</span>
      </button>
      {flagged && (
        <input
          type="text"
          className="event-discussion-note"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          onBlur={onNoteBlur}
          placeholder="What are you unsure about? (optional)"
          disabled={disabled}
          maxLength={280}
        />
      )}
    </div>
  );
}
