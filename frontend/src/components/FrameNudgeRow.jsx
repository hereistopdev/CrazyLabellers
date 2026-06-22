import { getNumpadNudgeLabel } from '../config/labelingHotkeys';

const FRAME_NUDGE_STEPS = [1, 3, 5];

export default function FrameNudgeRow({ onNudge, disabled = false }) {
  if (!onNudge) return null;

  return (
    <div className="frame-nudge-row" role="group" aria-label="Nudge event frame">
      {FRAME_NUDGE_STEPS.map((step) => (
        <div key={step} className="frame-nudge-group">
          <button
            type="button"
            className="frame-nudge-btn"
            onClick={() => onNudge(-step)}
            disabled={disabled}
            title={getNumpadNudgeLabel(step, 'back')}
            aria-label={`Back ${step} frame${step === 1 ? '' : 's'}`}
          >
            <span className="frame-nudge-icon" aria-hidden>
              ‹
            </span>
            <span className="frame-nudge-step">{step}</span>
          </button>
          <button
            type="button"
            className="frame-nudge-btn"
            onClick={() => onNudge(step)}
            disabled={disabled}
            title={getNumpadNudgeLabel(step, 'forward')}
            aria-label={`Forward ${step} frame${step === 1 ? '' : 's'}`}
          >
            <span className="frame-nudge-step">{step}</span>
            <span className="frame-nudge-icon" aria-hidden>
              ›
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}
