import { useMemo, useState } from 'react';
import { FPS } from '../config/frameOffsets';
import { formatEventTime, getFrameNumber } from '../utils/frameTime';
import { countEventSearchMatches, matchesEventSearch, normalizeEventSearchText } from '../utils/eventSearch';
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
  compareSection = null,
  discussionSection = null,
  asideHeight = null,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const searchActive = Boolean(normalizeEventSearchText(searchQuery));

  const sortedItems = useMemo(
    () =>
      events
        .map((event, index) => ({ event, index }))
        .sort((a, b) => a.event.frameTime - b.event.frameTime || a.index - b.index),
    [events]
  );

  const displayItems = useMemo(() => {
    if (!searchActive) return sortedItems;
    return sortedItems.filter(({ event }) => matchesEventSearch(searchQuery, event.eventType));
  }, [sortedItems, searchQuery, searchActive]);

  const matchCount = useMemo(
    () => countEventSearchMatches(searchQuery, events),
    [searchQuery, events]
  );

  const currentFrame = getFrameNumber(currentTime, fps);

  return (
    <div
      className="events-panel events-panel--labeling events-panel--review video-workspace-aside"
      style={asideHeight ? { height: asideHeight, maxHeight: asideHeight } : undefined}
    >
      <div className="events-panel-body">
        <div className="events-panel-scroll video-workspace-aside-events">
          {events.length > 0 && (
            <div className="events-panel-search events-panel-search--inline">
              <div className="video-workspace-aside-title">Find events</div>
              <EventSearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                matchCount={matchCount}
                totalCount={events.length}
              />
              {searchActive && (
                <p className="event-search-shortlist-hint">
                  Showing {matchCount} matching event{matchCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          {compareSection ? (
            <div className="events-panel-review-section events-panel-review-compare">{compareSection}</div>
          ) : null}

          <h3>Events ({events.length})</h3>

          <div className="events-list events-list--labeling review-events-list">
            {events.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No submission events</p>
            ) : displayItems.length === 0 ? (
              <p className="event-search-empty">
                No events match &ldquo;{searchQuery.trim()}&rdquo;
              </p>
            ) : (
              displayItems.map(({ event, index }) => {
                const row = eventRows[index];
                const isActive = getFrameNumber(event.frameTime, fps) === currentFrame;
                const isSelected = selectedIndex === index;
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
                      searchActive ? 'event-search-match' : '',
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
              })
            )}
          </div>

          {discussionSection ? (
            <div className="events-panel-review-section events-panel-review-discussion">
              {discussionSection}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
