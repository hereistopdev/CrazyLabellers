import { frameOffsetSummary } from '../config/frameOffsets';

export default function LabelingHelpModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card labeling-help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="labeling-help-modal-header">
          <h3>Labeling guide</h3>
          <button type="button" className="labeling-help-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="labeling-help-modal-body">
          <p>
            {frameOffsetSummary} · Immediate follow-up: <strong>0</strong> at touch
          </p>
          <p>
            Pause on the frame, then press <kbd>Enter</kbd> or <kbd>M</kbd> to pick an event. Each
            mark auto-saves. Flag uncertain events for validator discussion below.
          </p>
          <p>
            Click an event on the timeline or list, then <kbd>Insert</kbd> to change its type or{' '}
            <kbd>Del</kbd> to remove it.
          </p>
          <p>
            <strong>Spacing rules:</strong> only one event per frame, with at least one blank frame
            between any two events. Submit is blocked until these rules are met.
          </p>
        </div>
      </div>
    </div>
  );
}
