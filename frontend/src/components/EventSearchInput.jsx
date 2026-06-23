import { normalizeEventSearchText } from '../utils/eventSearch';

export default function EventSearchInput({
  value,
  onChange,
  matchCount = 0,
  totalCount = 0,
  placeholder = 'Search events…',
  className = '',
}) {
  const active = Boolean(normalizeEventSearchText(value));

  return (
    <div className={`event-search${className ? ` ${className}` : ''}`}>
      <input
        type="search"
        className="event-search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search events by type"
      />
      {active && (
        <span className="event-search-meta" aria-live="polite">
          {matchCount} of {totalCount}
        </span>
      )}
    </div>
  );
}
