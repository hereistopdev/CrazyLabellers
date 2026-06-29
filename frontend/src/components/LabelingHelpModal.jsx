import { Link } from 'react-router-dom';
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
          <h3>Labeling quick reference</h3>
          <button type="button" className="labeling-help-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="labeling-help-modal-body">
          <p>
            <Link to="/labeling-guide" onClick={onClose}>
              Open full labeling guide →
            </Link>
          </p>
          <p>
            {frameOffsetSummary} · Immediate follow-up: <strong>0</strong> at touch
          </p>
          <p>
            Pause on the frame, then press <kbd>Enter</kbd> or <kbd>M</kbd> to pick an event. Each
            mark auto-saves. Flag uncertain events for validator discussion below.
          </p>
          <p>
            <strong>Spacing:</strong> {getEventSpacingRuleSummary()}
          </p>
          <p>
            <strong>Pair timing:</strong> {getEventPairTimingRuleSummary()}
          </p>
          <p>
            <strong>Tackle / Foul / Referee:</strong> {getTackleFoulRuleSummary()} Mark Referee for
            offside stoppages (no Foul).
          </p>
          <p>
            <strong>Highlights:</strong> no gameplay events inside Highlight Start → Highlight End.
            Recovery / Pass Received cannot be first or directly after Highlight End.
          </p>
          <p>
            <strong>Clearance:</strong> same team receives → Pass Received; opponent → Recovery.
          </p>
          <p>
            <strong>BAD:</strong> Pass → Pass → Pass Received → Pass Received — review the chain.
          </p>
        </div>
      </div>
    </div>
  );
}
