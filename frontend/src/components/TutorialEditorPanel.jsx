import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatTutorialTime, getActiveTutorialStep } from '../utils/tutorialFormat';

const EMPTY_STEP = { frameTime: 0, eventType: '', title: '', explanation: '' };

export default function TutorialEditorPanel({
  assignment,
  currentTime,
  fps,
  eventTypes = [],
  onJumpToStep,
  onSaved,
}) {
  const [intro, setIntro] = useState(assignment?.tutorialIntro || '');
  const [steps, setSteps] = useState(assignment?.tutorialSteps || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setIntro(assignment?.tutorialIntro || '');
    setSteps(assignment?.tutorialSteps?.length ? [...assignment.tutorialSteps] : []);
  }, [assignment?._id, assignment?.tutorialIntro, assignment?.tutorialSteps]);

  const currentFrame = Math.round(currentTime * fps);
  const activeStep = getActiveTutorialStep(steps, currentTime, fps);
  const activeIndex = activeStep ? steps.indexOf(activeStep) : -1;

  const updateStep = (index, field, value) => {
    setSteps((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addAtCurrentFrame = () => {
    setSteps((prev) =>
      [...prev, { ...EMPTY_STEP, frameTime: Math.round(currentTime * 100) / 100 }].sort(
        (a, b) => a.frameTime - b.frameTime
      )
    );
  };

  const removeStep = (index) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateAdminTask(assignment._id, {
        kind: 'tutorial',
        tutorialIntro: intro.trim(),
        tutorialSteps: steps.map((s) => ({
          frameTime: Number(s.frameTime) || 0,
          eventType: String(s.eventType || '').trim(),
          title: String(s.title || '').trim(),
          explanation: String(s.explanation || '').trim(),
        })),
      });
      onSaved?.(updated);
      setMessage('Tutorial explanations saved');
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="tutorial-panel-pro tutorial-panel-pro--editor">
      <header className="tutorial-panel-pro-header">
        <div>
          <span className="tutorial-panel-eyebrow">Admin · Tutorial authoring</span>
          <h3>Frame explanations</h3>
        </div>
        <span className="tutorial-panel-count">{steps.length} steps</span>
      </header>

      <p className="tutorial-editor-lead">
        Pause on the target frame, add a step, then describe why the event belongs there. Fields
        can be filled in gradually.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <label className="tutorial-editor-intro-field">
        <span>Overview for labellers</span>
        <textarea
          rows={2}
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          placeholder="Brief context before they start labeling this clip…"
        />
      </label>

      <div className="tutorial-editor-toolbar">
        <button type="button" className="btn btn-secondary btn-sm" onClick={addAtCurrentFrame}>
          + Add step at frame {currentFrame}
        </button>
        <span className="tutorial-editor-time">{formatTutorialTime(currentTime)}</span>
      </div>

      {activeStep && activeIndex >= 0 && (
        <section className="tutorial-spotlight tutorial-spotlight--editor">
          <span className="tutorial-spotlight-label">Editing near current frame</span>
          <p className="tutorial-spotlight-text">
            Step {activeIndex + 1} · {activeStep.eventType || 'No event yet'}
          </p>
        </section>
      )}

      <div className="tutorial-step-track tutorial-step-track--editor">
        {steps.length === 0 ? (
          <div className="tutorial-panel-empty">
            <p>No steps yet. Scrub to a frame and click “Add step”.</p>
          </div>
        ) : (
          steps.map((step, index) => {
            const frame = Math.round(step.frameTime * fps);
            const isActive = Math.abs(frame - currentFrame) <= 1;
            return (
              <article
                key={step._id || `step-${index}`}
                className={`tutorial-step-card tutorial-step-card--editor${isActive ? ' active' : ''}`}
              >
                <div className="tutorial-step-card-rail">
                  <span className="tutorial-step-index">{index + 1}</span>
                </div>
                <div className="tutorial-step-card-body tutorial-step-card-body--editor">
                  <div className="tutorial-editor-grid">
                    <label>
                      <span>Time (s)</span>
                      <input
                        type="number"
                        step="0.04"
                        value={step.frameTime}
                        onChange={(e) => updateStep(index, 'frameTime', e.target.value)}
                      />
                    </label>
                    <label>
                      <span>Event type</span>
                      <input
                        list={`tutorial-events-${index}`}
                        value={step.eventType}
                        onChange={(e) => updateStep(index, 'eventType', e.target.value)}
                        placeholder="Optional"
                      />
                      <datalist id={`tutorial-events-${index}`}>
                        {eventTypes.map((t) => (
                          <option key={t} value={t} />
                        ))}
                      </datalist>
                    </label>
                    <label className="tutorial-editor-grid-full">
                      <span>Short title</span>
                      <input
                        value={step.title || ''}
                        onChange={(e) => updateStep(index, 'title', e.target.value)}
                        placeholder="Optional headline"
                      />
                    </label>
                    <label className="tutorial-editor-grid-full">
                      <span>Why this frame?</span>
                      <textarea
                        rows={3}
                        value={step.explanation || ''}
                        onChange={(e) => updateStep(index, 'explanation', e.target.value)}
                        placeholder="Describe what the labeller should see and why the event is marked here…"
                      />
                    </label>
                  </div>
                  <div className="tutorial-step-editor-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onJumpToStep?.(Number(step.frameTime) || 0)}
                    >
                      Go to frame {frame}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removeStep(index)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      <footer className="tutorial-editor-footer">
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save tutorial explanations'}
        </button>
      </footer>
    </aside>
  );
}
