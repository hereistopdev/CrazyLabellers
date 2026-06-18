import { FPS } from '../config/frameOffsets';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2);
  return `${m}:${s.padStart(5, '0')}`;
}

export default function TutorialPanel({ assignment, currentTime, fps = FPS, onJumpToStep }) {
  const steps = assignment?.tutorialSteps || [];
  const currentFrame = Math.round(currentTime * fps);

  const activeStep = steps.find(
    (step) => Math.abs(Math.round(step.frameTime * fps) - currentFrame) <= 1
  );

  if (!steps.length && !assignment?.tutorialIntro) {
    return (
      <div className="tutorial-panel card">
        <h3>Tutorial</h3>
        <p className="tutorial-empty">No step explanations configured for this clip yet.</p>
      </div>
    );
  }

  return (
    <div className="tutorial-panel card">
      <h3>Tutorial guide</h3>
      {assignment?.tutorialIntro && (
        <p className="tutorial-intro">{assignment.tutorialIntro}</p>
      )}

      {activeStep && (
        <div className="tutorial-active-step">
          <span className="tutorial-active-label">At this frame</span>
          <strong>{activeStep.eventType}</strong>
          {activeStep.title && <span className="tutorial-step-title">{activeStep.title}</span>}
          <p>{activeStep.explanation}</p>
        </div>
      )}

      <ol className="tutorial-steps-list">
        {steps.map((step) => {
          const frame = Math.round(step.frameTime * fps);
          const isActive = Math.abs(frame - currentFrame) <= 1;
          return (
            <li key={step._id || `${step.frameTime}-${step.eventType}`} className={isActive ? 'active' : ''}>
              <button
                type="button"
                className="tutorial-step-btn"
                onClick={() => onJumpToStep?.(step.frameTime)}
              >
                <span className="tutorial-step-time">
                  Frame {frame} · {formatTime(step.frameTime)}
                </span>
                <strong>{step.eventType}</strong>
                {step.title && <span className="tutorial-step-title">{step.title}</span>}
              </button>
              <p className="tutorial-step-explanation">{step.explanation}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
