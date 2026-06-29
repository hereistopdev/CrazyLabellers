import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [imageLabelingEnabled, setImageLabelingEnabled] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsError, setSettingsError] = useState('');

  useEffect(() => {
    api
      .getFinanceSettings()
      .then((settings) => {
        setImageLabelingEnabled(settings.labellerImageLabelingEnabled !== false);
      })
      .catch((err) => setSettingsError(err.message))
      .finally(() => setSettingsLoading(false));
  }, []);

  const handleToggleImageLabeling = async (enabled) => {
    setSettingsSaving(true);
    setSettingsError('');
    setSettingsMessage('');
    try {
      const settings = await api.updateFinanceSettings({ labellerImageLabelingEnabled: enabled });
      setImageLabelingEnabled(settings.labellerImageLabelingEnabled !== false);
      setSettingsMessage(
        enabled
          ? 'Labellers can now see image keypoint projects'
          : 'Image projects hidden from labellers — they will only see video labeling tasks'
      );
    } catch (err) {
      setSettingsError(err.message);
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Admin — {user?.name}</h1>
        <p>Manage labellers, review work, score tasks, and track payments.</p>
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ marginBottom: '0.35rem' }}>Labeller task visibility</h3>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Control whether labellers see image keypoint projects in the nav and dashboard. Video
          labeling tasks are always available when onboarding is complete.
        </p>
        {settingsError && <div className="alert alert-error">{settingsError}</div>}
        {settingsMessage && <div className="alert alert-success">{settingsMessage}</div>}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.92rem' }}>
          <input
            type="checkbox"
            checked={imageLabelingEnabled}
            disabled={settingsLoading || settingsSaving}
            onChange={(e) => handleToggleImageLabeling(e.target.checked)}
          />
          Show image labeling tasks to labellers
        </label>
      </div>

      <div className="step-cards">
        <div className="step-card">
          <div className="step-number">1</div>
          <h3>Manage Validators</h3>
          <p>Create validator accounts that review submitted tasks and assign scores.</p>
          <div className="actions-row">
            <Link to="/admin/validators" className="btn btn-primary btn-sm">
              Open validators
            </Link>
          </div>
        </div>

        <div className="step-card">
          <div className="step-number">2</div>
          <h3>Manage Video Managers</h3>
          <p>Approve manager registrations and grant access to upload clips and reference JSON.</p>
          <div className="actions-row">
            <Link to="/admin/video-managers" className="btn btn-primary btn-sm">
              Open video managers
            </Link>
          </div>
        </div>

        <div className="step-card">
          <div className="step-number">3</div>
          <h3>Knowledge test bank</h3>
          <p>View all onboarding test questions with correct answers and explanations.</p>
          <div className="actions-row">
            <Link to="/admin/knowledge-test" className="btn btn-primary btn-sm">
              View questions
            </Link>
          </div>
        </div>

        <div className="step-card">
          <div className="step-number">4</div>
          <h3>Manage Labellers</h3>
          <p>Add, remove, or manually approve labellers without requiring the knowledge test.</p>
          <div className="actions-row">
            <Link to="/admin/labellers" className="btn btn-primary btn-sm">
              Open labellers
            </Link>
          </div>
        </div>

        <div className="step-card">
          <div className="step-number">5</div>
          <h3>Bulk upload videos</h3>
          <p>
            Import a whole folder of clips and reference JSON from your browser (data/*.mp4 +
            annotations/*.json).
          </p>
          <div className="actions-row">
            <Link to="/admin/videos#bulk-upload" className="btn btn-primary btn-sm">
              Bulk upload folder
            </Link>
            <Link to="/admin/videos" className="btn btn-secondary btn-sm">
              Manage videos
            </Link>
          </div>
        </div>

        <div className="step-card">
          <div className="step-number">6</div>
          <h3>Manage Tasks</h3>
          <p>Tutorial examples, pre-test clips, production groups, and frame explanations.</p>
          <div className="actions-row">
            <Link to="/admin/tasks" className="btn btn-primary btn-sm">
              Open tasks
            </Link>
          </div>
        </div>

        <div className="step-card">
          <div className="step-number">7</div>
          <h3>Review & Score Tasks</h3>
          <p>Review labeled videos, assign review points (0–100), and calculate labeller earnings.</p>
          <div className="actions-row">
            <Link to="/review" className="btn btn-primary btn-sm">
              Review submissions
            </Link>
          </div>
        </div>

        <div className="step-card">
          <div className="step-number">8</div>
          <h3>Finance Dashboard</h3>
          <p>See total payouts, per-labeller earnings, review points, and set the rate per point.</p>
          <div className="actions-row">
            <Link to="/admin/finance" className="btn btn-secondary btn-sm">
              Finance dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
