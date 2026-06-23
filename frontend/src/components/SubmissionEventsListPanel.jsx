import { useMemo, useState } from 'react';
import { FPS } from '../config/frameOffsets';
import { formatEventTime, getFrameNumber } from '../utils/frameTime';
import { countEventSearchMatches, matchesEventSearch } from '../utils/eventSearch';
import EventSearchInput from './EventSearchInput';

function formatTime(seconds, fps = FPS) {
  return formatEventTime(seconds, fps);
}

function comparisonLabel(status, frameDiff) {
  if (status === 'match') return 'Match';
  if (status === 'close') return '1f off';
  if (status === 'off') return `${frameDiff ?? '2+'}f off`;
  if (status === 'extra') return 'Extra';
  if (status === 'unmatched') return 'No ref';
  if (status === 'missing') return 'Missing';
  return null;
}

export default function SubmissionEventsListPanel({
  events = [],
  eventRows = [],
  currentTime = 0,
  fps = FPS,
  onSeek,
  selectedIndex = null,
  onSelect,
  previewMode = false,
  className = '',
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const searchActive = Boolean(searchQuery.trim());

  const sortedItems = useMemo(
    () =>
      events
        .map((event, index) => ({ event, index }))
        .sort((a, b) => a.event.frameTime - b.event.frameTime || a.index - b.index),
    [events]
  );

  const matchCount = useMemo(
    () => countEventSearchMatches(searchQuery, events),
    [searchQuery, events]
  );

  const currentFrame = getFrameNumber(currentTime, fps);

  if (!events.length) return null;

  return (
    <aside className={`review-events-sidebar${className ? ` ${className}` : ''}`}>
      <div className="review-attention-panel review-events-sidebar-panel">
        <div className="review-attention-title">Events ({events.length})</div>
        <EventSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          matchCount={matchCount}
          totalCount={events.length}
        />
        <div className="events-list review-events-list">
          {sortedItems.map(({ event, index }) => {
            const row = eventRows[index];
            const isActive = getFrameNumber(event.frameTime, fps) === currentFrame;
            const isSelected = selectedIndex === index;
            const isMatch = matchesEventSearch(searchQuery, event.eventType);
            const dimmed = searchActive && !isMatch;
            const validationStatus = row?.validation?.status || 'pending';
            const comparisonStatus = row?.comparisonStatus;

            return (
              <div
                key={`review-event-${index}-${event.eventType}-${event.frameTime}`}
                className={[
                  'event-row-wrap',
                  'review-event-row-wrap',
                  isActive ? 'active' : '',
                  isSelected ? 'selected' : '',
                  event.needsDiscussion ? 'needs-discussion' : '',
                  isMatch ? 'event-search-match' : '',
                  dimmed ? 'event-search-dimmed' : '',
                  !previewMode ? `validation-${validationStatus}` : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div
                  className={[
                    'event-row',
                    'review-event-row',
                    isActive ? 'active' : '',
                    isSelected ? 'selected' : '',
                    event.needsDiscussion ? 'needs-discussion' : '',
                    isMatch ? 'event-search-match' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    onSelect?.(index);
                    onSeek?.(event.frameTime);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect?.(index);
                      onSeek?.(event.frameTime);
                    }
                  }}
                >
                  <div className="review-event-main">
                    <span className="time">{formatTime(event.frameTime, fps)}</span>
                    <span className="type">{event.eventType}</span>
                    {event.needsDiscussion && (
                      <span className="review-discussion-badge" title={event.notes || undefined}>
                        ⚑
                      </span>
                    )}
                    {comparisonStatus && (
                      <span className={`comparison-badge comparison-${comparisonStatus}`}>
                        {comparisonLabel(comparisonStatus, row?.frameDiff)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {searchActive && matchCount === 0 && (
          <p className="event-search-empty">No events match &ldquo;{searchQuery.trim()}&rdquo;</p>
        )}
      </div>
    </aside>
  );
}
