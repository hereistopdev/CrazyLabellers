import { formatTutorialTime, getActiveTutorialStep } from '../utils/tutorialFormat';
import { getFrameNumber, toDisplayFrame } from '../utils/frameTime';

export default function TutorialPanel({ assignment, currentTime, fps, onJumpToStep }) {
  const steps = assignment?.tutorialSteps || [];
  const activeStep = getActiveTutorialStep(steps, currentTime, fps);

  if (!steps.length && !assignment?.tutorialIntro) {
    return (
      <aside className="tutorial-panel-pro">
        <header className="tutorial-panel-pro-header">
          <div>
            <span className="tutorial-panel-eyebrow">Guided labeling</span>
            <h3>Tutorial guide</h3>
          </div>
        </header>
        <div className="tutorial-panel-empty">
          <p>No frame explanations have been added for this clip yet.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="tutorial-panel-pro">
      <header className="tutorial-panel-pro-header">
        <div>
          <span className="tutorial-panel-eyebrow">Guided labeling</span>
          <h3>Tutorial guide</h3>
        </div>
        <span className="tutorial-panel-count">{steps.length} steps</span>
      </header>

      {assignment?.tutorialIntro && (
        <div className="tutorial-panel-intro">{assignment.tutorialIntro}</div>
      )}

      {activeStep && (
        <section className="tutorial-spotlight" aria-label="Current frame explanation">
          <span className="tutorial-spotlight-label">At this frame</span>
          <div className="tutorial-spotlight-meta">
            {activeStep.eventType ? (
              <span className="tutorial-event-pill">{activeStep.eventType}</span>
            ) : (
              <span className="tutorial-event-pill tutorial-event-pill-muted">Event pending</span>
            )}
            {activeStep.title && <span className="tutorial-spotlight-title">{activeStep.title}</span>}
          </div>
          <p className="tutorial-spotlight-text">
            {activeStep.explanation?.trim() || 'Explanation will appear here once configured.'}
          </p>
        </section>
      )}

      <div className="tutorial-step-track">
        {steps.map((step, index) => {
          const frame = getFrameNumber(step.frameTime, fps);
          const isActive = Math.abs(frame - getFrameNumber(currentTime, fps)) <= 1;
          return (
            <article
              key={step._id || `${step.frameTime}-${index}`}
              className={`tutorial-step-card${isActive ? ' active' : ''}`}
            >
              <div className="tutorial-step-card-rail">
                <span className="tutorial-step-index">{index + 1}</span>
                {index < steps.length - 1 && <span className="tutorial-step-line" aria-hidden />}
              </div>
              <div className="tutorial-step-card-body">
                <button
                  type="button"
                  className="tutorial-step-jump"
                  onClick={() => onJumpToStep?.(step.frameTime)}
                >
                  <span className="tutorial-step-frame">
                    Frame {toDisplayFrame(frame)} · {formatTutorialTime(step.frameTime)}
                  </span>
                  {step.eventType ? (
                    <span className="tutorial-event-pill">{step.eventType}</span>
                  ) : null}
                  {step.title && <span className="tutorial-step-card-title">{step.title}</span>}
                </button>
                {step.explanation?.trim() && (
                  <p className="tutorial-step-card-text">{step.explanation}</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
