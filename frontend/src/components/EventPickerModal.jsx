import { useEffect } from 'react';
import {
  formatOffset,
  getImmediateFollowUpRule,
  resolveFrameOffset,
  applyFrameOffset,
} from '../config/frameOffsets';

const EXTRA_KEYS = ['0', 'q', 'w', 'e', 'r', 't'];

function getShortcut(index) {
  if (index < 9) return String(index + 1);
  if (index === 9) return '0';
  return EXTRA_KEYS[index - 9] ?? '';
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2);
  return `${m}:${s.padStart(5, '0')}`;
}

export default function EventPickerModal({
  open,
  eventTypes,
  lastEvent,
  currentTime,
  onSelect,
  onClose,
}) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      const index = eventTypes.findIndex(
        (_, i) => getShortcut(i).toLowerCase() === event.key.toLowerCase()
      );
      if (index >= 0) {
        event.preventDefault();
        onSelect(eventTypes[index]);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, eventTypes, onSelect, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card event-picker-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Mark event at {formatTime(currentTime)}</h3>
        <p className="modal-sub">Press a number key or click an event. Esc to cancel.</p>
        <div className="event-picker-grid">
          {eventTypes.map((eventType, index) => {
            const followUpRule = lastEvent
              ? getImmediateFollowUpRule(lastEvent.eventType, eventType)
              : null;
            const useFollowUp = Boolean(followUpRule);
            const offset = resolveFrameOffset(eventType, {
              immediateFollowUp: useFollowUp,
              afterEvent: useFollowUp ? lastEvent?.eventType : null,
            });
            const markedAt = applyFrameOffset(currentTime, eventType, {
              immediateFollowUp: useFollowUp,
              afterEvent: useFollowUp ? lastEvent?.eventType : null,
            });

            return (
              <button
                key={eventType}
                type="button"
                className="event-picker-item"
                onClick={() => onSelect(eventType)}
              >
                <span className="event-picker-num">{getShortcut(index)}</span>
                <span className="event-picker-label">{eventType}</span>
                <span className="event-picker-meta">
                  {formatTime(markedAt)} ({formatOffset(offset)}f
                  {useFollowUp ? ', follow-up' : ''})
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
