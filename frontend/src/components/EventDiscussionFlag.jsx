export function EventDiscussionNote({ note = '', disabled = false, onNoteChange, onNoteBlur }) {
  return (
    <input
      type="text"
      className="event-discussion-note event-discussion-note-below"
      value={note}
      onChange={(e) => onNoteChange(e.target.value)}
      onBlur={onNoteBlur}
      placeholder="What are you unsure about? (optional)"
      disabled={disabled}
      maxLength={280}
    />
  );
}

export default function EventDiscussionFlag({
  flagged = false,
  note = '',
  disabled = false,
  iconOnly = false,
  onToggle,
  onNoteChange,
  onNoteBlur,
}) {
  const toggleButton = (
    <button
      type="button"
      className={
        iconOnly
          ? `event-row-icon-btn event-row-icon-btn-discuss${flagged ? ' is-on' : ''}`
          : `event-discussion-toggle${flagged ? ' event-discussion-toggle-on' : ''}`
      }
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      disabled={disabled}
      title={
        flagged
          ? 'Remove flag — no longer needs discussion'
          : 'Flag for validator or admin discussion'
      }
      aria-pressed={flagged}
      aria-label={flagged ? 'Flagged for discussion' : 'Discuss with reviewer'}
    >
      <span className="event-row-icon-btn-symbol" aria-hidden>
        ⚑
      </span>
      {!iconOnly && <span>{flagged ? 'Flagged for discussion' : 'Discuss with reviewer'}</span>}
    </button>
  );

  if (iconOnly) {
    return toggleButton;
  }

  return (
    <div className={`event-discussion-flag${flagged ? ' is-flagged' : ''}`}>
      {toggleButton}
      {flagged && (
        <EventDiscussionNote
          note={note}
          disabled={disabled}
          onNoteChange={onNoteChange}
          onNoteBlur={onNoteBlur}
        />
      )}
    </div>
  );
}
