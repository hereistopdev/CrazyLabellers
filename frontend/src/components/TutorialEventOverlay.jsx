import { useMemo } from 'react';
import { getActiveTutorialStep } from '../utils/tutorialFormat';
import { eventCategories } from '../data/eventFlows';

function getEventAccent(eventType) {
  for (const category of eventCategories) {
    if (category.events.includes(eventType)) {
      return category.color;
    }
  }
  return '#22c55e';
}

export default function TutorialEventOverlay({ steps = [], currentTime, fps }) {
  const activeStep = useMemo(
    () => getActiveTutorialStep(steps, currentTime, fps),
    [steps, currentTime, fps]
  );

  if (!activeStep?.eventType?.trim()) {
    return null;
  }

  const accent = getEventAccent(activeStep.eventType);
  const headline = activeStep.title?.trim() || activeStep.eventType;
  const showTypeLabel = Boolean(activeStep.title?.trim());

  return (
    <div className="tutorial-event-overlay" aria-live="polite" aria-atomic="true">
      <div
        key={`${activeStep.frameTime}-${activeStep.eventType}`}
        className="tutorial-event-callout"
        style={{ '--tutorial-accent': accent }}
      >
        <div className="tutorial-event-callout-glow" aria-hidden />
        {showTypeLabel && (
          <span className="tutorial-event-callout-type">{activeStep.eventType}</span>
        )}
        <p className="tutorial-event-callout-title">{headline}</p>
      </div>
    </div>
  );
}
