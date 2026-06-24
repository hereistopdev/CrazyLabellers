import { frameOffsetSummary } from '../config/frameOffsets';
import {
  getEventSpacingRuleSummary,
  getEventPairTimingRuleSummary,
  getTackleFoulRuleSummary,
} from '../utils/eventSpacingValidation';

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
            <strong>Spacing rules:</strong> {getEventSpacingRuleSummary()} Submit is blocked until
            these rules are met.
          </p>
          <p>
            <strong>Pair timing:</strong> {getEventPairTimingRuleSummary()}
          </p>
          <p>
            <strong>Tackle / Foul / Referee:</strong> {getTackleFoulRuleSummary()}
          </p>
          <p>
            <strong>Take on / Take on End:</strong> mark Take on when the attacker commits to
            beating a defender; mark Take on End when the duel is clearly finished (≥ 6 even frames
            apart).
          </p>
          <p>
            <strong>Interception / Interception 2:</strong> Interception for a nearby cut-out attempt;
            Interception 2 for a clear interception farther from the intended receiver.
          </p>
        </div>
      </div>
    </div>
  );
}
