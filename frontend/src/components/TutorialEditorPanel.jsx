import { useEffect, useState } from 'react';
import { api } from '../api';
import { FPS } from '../config/frameOffsets';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2);
  return `${m}:${s.padStart(5, '0')}`;
}

const EMPTY_STEP = { frameTime: 0, eventType: '', title: '', explanation: '' };

export default function TutorialEditorPanel({
  assignment,
  currentTime,
  fps = FPS,
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
      const payload = {
        kind: 'tutorial',
        tutorialIntro: intro.trim(),
        tutorialSteps: steps.map((s) => ({
          frameTime: Number(s.frameTime) || 0,
          eventType: String(s.eventType || '').trim(),
          title: String(s.title || '').trim(),
          explanation: String(s.explanation || '').trim(),
        })),
      };
      const updated = await api.updateAdminTask(assignment._id, payload);
      onSaved?.(updated);
      setMessage('Tutorial explanations saved');
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const activeStep = steps.find(
    (step) => Math.abs(Math.round(step.frameTime * fps) - currentFrame) <= 1
  );

  return (
    <div className="tutorial-panel tutorial-editor-panel card">
      <div className="tutorial-editor-header">
        <h3>Edit tutorial explanations</h3>
        <span className="tutorial-editor-badge">Admin</span>
      </div>
      <p className="tutorial-editor-hint">
        Pause on a frame, then add or edit steps. Labellers see these explanations in this panel
        while labeling.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <label className="tutorial-editor-field">
        Intro (shown above the step list)
        <textarea
          rows={2}
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          placeholder="What should the labeller look for in this clip?"
        />
      </label>

      {activeStep && (
        <div className="tutorial-active-step">
          <span className="tutorial-active-label">Preview at current frame</span>
          <strong>{activeStep.eventType || '—'}</strong>
          {activeStep.title && <span className="tutorial-step-title">{activeStep.title}</span>}
          <p>{activeStep.explanation || 'No explanation text yet.'}</p>
        </div>
      )}

      <div className="tutorial-editor-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={addAtCurrentFrame}>
          Add step at {formatTime(currentTime)} (frame {currentFrame})
        </button>
      </div>

      <ol className="tutorial-steps-list tutorial-steps-editor-list">
        {steps.length === 0 ? (
          <li className="tutorial-empty">No steps yet — add one at the current frame.</li>
        ) : (
          steps.map((step, index) => {
            const frame = Math.round(step.frameTime * fps);
            const isActive = Math.abs(frame - currentFrame) <= 1;
            return (
              <li key={step._id || `step-${index}`} className={isActive ? 'active' : ''}>
                <div className="tutorial-step-editor-fields">
                  <label>
                    Time (s)
                    <input
                      type="number"
                      step="0.04"
                      value={step.frameTime}
                      onChange={(e) => updateStep(index, 'frameTime', e.target.value)}
                    />
                  </label>
                  <label>
                    Event
                    <input
                      list={`tutorial-events-${index}`}
                      value={step.eventType}
                      onChange={(e) => updateStep(index, 'eventType', e.target.value)}
                      placeholder="Pass, Shot..."
                    />
                    <datalist id={`tutorial-events-${index}`}>
                      {eventTypes.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    Title
                    <input
                      value={step.title || ''}
                      onChange={(e) => updateStep(index, 'title', e.target.value)}
                      placeholder="Short label"
                    />
                  </label>
                  <label className="tutorial-editor-field-full">
                    Why this frame?
                    <textarea
                      rows={2}
                      value={step.explanation || ''}
                      onChange={(e) => updateStep(index, 'explanation', e.target.value)}
                      placeholder="Explain what the labeller should see here..."
                    />
                  </label>
                  <div className="tutorial-step-editor-buttons">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onJumpToStep?.(Number(step.frameTime) || 0)}
                    >
                      Go to frame
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
              </li>
            );
          })
        )}
      </ol>

      <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
        {saving ? 'Saving...' : 'Save tutorial explanations'}
      </button>
    </div>
  );
}
