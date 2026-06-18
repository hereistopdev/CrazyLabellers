import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { formatTimestamp } from '../utils/formatTimestamp';
import { formatMoney } from '../utils/money';

const KIND_TABS = [
  { id: 'groups', label: 'Groups' },
  { id: 'tutorial', label: 'Tutorial' },
  { id: 'pretest', label: 'Pre-test' },
  { id: 'production', label: 'Production' },
];

const EMPTY_STEP = { frameTime: 0, eventType: '', title: '', explanation: '' };

function TaskEditor({ task, groups, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    title: task.title || '',
    description: task.description || '',
    kind: task.kind || 'production',
    sortOrder: task.sortOrder ?? 0,
    groupId: task.groupId?._id || task.groupId || '',
    taskPrice: task.taskPrice ?? 1,
    challengeNote: task.challengeNote || '',
    tutorialIntro: task.tutorialIntro || '',
    tutorialSteps: task.tutorialSteps?.length ? [...task.tutorialSteps] : [{ ...EMPTY_STEP }],
  });

  const updateStep = (index, field, value) => {
    setForm((prev) => {
      const steps = [...prev.tutorialSteps];
      steps[index] = { ...steps[index], [field]: value };
      return { ...prev, tutorialSteps: steps };
    });
  };

  const addStep = () => {
    setForm((prev) => ({
      ...prev,
      tutorialSteps: [...prev.tutorialSteps, { ...EMPTY_STEP }],
    }));
  };

  const removeStep = (index) => {
    setForm((prev) => ({
      ...prev,
      tutorialSteps: prev.tutorialSteps.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      title: form.title,
      description: form.description,
      kind: form.kind,
      sortOrder: Number(form.sortOrder) || 0,
      groupId: form.groupId || null,
      taskPrice: Number(form.taskPrice),
      challengeNote: form.challengeNote,
      tutorialIntro: form.tutorialIntro,
      tutorialSteps: form.tutorialSteps.map((s) => ({
        frameTime: Number(s.frameTime) || 0,
        eventType: s.eventType.trim(),
        title: s.title.trim(),
        explanation: s.explanation.trim(),
      })),
    });
  };

  return (
    <form className="task-editor card" onSubmit={handleSubmit}>
      <h3>Edit task</h3>
      <div className="form-grid">
        <label>
          Title
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </label>
        <label>
          Kind
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="tutorial">Tutorial</option>
            <option value="pretest">Pre-test</option>
            <option value="production">Production</option>
          </select>
        </label>
        <label>
          Sort order
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
          />
        </label>
        {form.kind === 'production' && (
          <>
            <label>
              Group
              <select
                value={form.groupId}
                onChange={(e) => setForm({ ...form, groupId: e.target.value })}
              >
                <option value="">No group</option>
                {groups.map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Task price ($)
              <input
                type="number"
                step="0.05"
                min="0.3"
                max="2"
                value={form.taskPrice}
                onChange={(e) => setForm({ ...form, taskPrice: e.target.value })}
              />
            </label>
            <label className="form-grid-full">
              Challenge note
              <input
                value={form.challengeNote}
                onChange={(e) => setForm({ ...form, challengeNote: e.target.value })}
              />
            </label>
          </>
        )}
        <label className="form-grid-full">
          Description
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
      </div>

      {form.kind === 'tutorial' && (
        <div className="tutorial-steps-editor">
          <label className="form-grid-full">
            Tutorial intro
            <textarea
              rows={2}
              value={form.tutorialIntro}
              onChange={(e) => setForm({ ...form, tutorialIntro: e.target.value })}
              placeholder="Brief overview shown before the step list"
            />
          </label>
          <h4>Frame explanations</h4>
          {form.tutorialSteps.map((step, index) => (
            <div key={index} className="tutorial-step-editor-row">
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
                Event type
                <input
                  value={step.eventType}
                  onChange={(e) => updateStep(index, 'eventType', e.target.value)}
                  placeholder="Pass, Shot, Goal..."
                />
              </label>
              <label>
                Title
                <input
                  value={step.title}
                  onChange={(e) => updateStep(index, 'title', e.target.value)}
                  placeholder="Short label"
                />
              </label>
              <label className="form-grid-full">
                Why this frame?
                <textarea
                  rows={2}
                  value={step.explanation}
                  onChange={(e) => updateStep(index, 'explanation', e.target.value)}
                />
              </label>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => removeStep(index)}>
                Remove step
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={addStep}>
            Add step
          </button>
        </div>
      )}

      <div className="actions-row" style={{ marginTop: '1rem' }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Saving...' : 'Save task'}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function ManageTasks() {
  const [tab, setTab] = useState('tutorial');
  const [groups, setGroups] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', description: '', sortOrder: 0 });
  const [editingGroupId, setEditingGroupId] = useState(null);

  const loadGroups = () =>
    api.getTaskGroups().then(setGroups).catch((err) => setError(err.message));

  const loadTasks = (kind) => {
    if (kind === 'groups') return Promise.resolve([]);
    return api.getAdminTasks({ kind }).then(setTasks).catch((err) => setError(err.message));
  };

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([loadGroups(), loadTasks(tab === 'groups' ? null : tab)])
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [tab]);

  const handleSaveTask = async (body) => {
    setSaving(true);
    setError('');
    try {
      await api.updateAdminTask(editingId, body);
      setMessage('Task updated');
      setEditingId(null);
      await loadTasks(tab);
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingGroupId) {
        await api.updateTaskGroup(editingGroupId, groupForm);
        setMessage('Group updated');
      } else {
        await api.createTaskGroup(groupForm);
        setMessage('Group created');
      }
      setGroupForm({ name: '', description: '', sortOrder: 0 });
      setEditingGroupId(null);
      await loadGroups();
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!window.confirm('Delete this group? Tasks will be ungrouped.')) return;
    try {
      await api.deleteTaskGroup(id);
      setMessage('Group deleted');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const startEditGroup = (group) => {
    setEditingGroupId(group._id);
    setGroupForm({
      name: group.name,
      description: group.description || '',
      sortOrder: group.sortOrder ?? 0,
    });
  };

  if (loading && tab !== 'groups' && tasks.length === 0 && groups.length === 0) {
    return <div className="loading">Loading tasks...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Manage tasks</h1>
        <p>
          Configure tutorial examples, pre-test clips (3), production groups, and frame explanations.
          Upload videos from <Link to="/admin/videos">Videos</Link>, then assign kind and metadata here.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="tab-bar">
        {KIND_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => {
              setTab(t.id);
              setEditingId(null);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'groups' ? (
        <div className="manage-groups">
          <form className="card group-form" onSubmit={handleCreateGroup}>
            <h3>{editingGroupId ? 'Edit group' : 'New production group'}</h3>
            <div className="form-grid">
              <label>
                Name
                <input
                  required
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                />
              </label>
              <label>
                Sort order
                <input
                  type="number"
                  value={groupForm.sortOrder}
                  onChange={(e) => setGroupForm({ ...groupForm, sortOrder: e.target.value })}
                />
              </label>
              <label className="form-grid-full">
                Description
                <textarea
                  rows={2}
                  value={groupForm.description}
                  onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                />
              </label>
            </div>
            <div className="actions-row" style={{ marginTop: '0.75rem' }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {editingGroupId ? 'Update group' : 'Create group'}
              </button>
              {editingGroupId && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setEditingGroupId(null);
                    setGroupForm({ name: '', description: '', sortOrder: 0 });
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Tasks</th>
                  <th>Order</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-cell">
                      No groups yet
                    </td>
                  </tr>
                ) : (
                  groups.map((g) => (
                    <tr key={g._id}>
                      <td>
                        <strong>{g.name}</strong>
                        {g.description && (
                          <p className="table-muted">{g.description}</p>
                        )}
                      </td>
                      <td>{g.taskCount ?? 0}</td>
                      <td>{g.sortOrder}</td>
                      <td>{formatTimestamp(g.createdAt)}</td>
                      <td>{formatTimestamp(g.updatedAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => startEditGroup(g)}
                        >
                          Edit
                        </button>{' '}
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteGroup(g._id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {editingId && (
            <TaskEditor
              task={tasks.find((t) => t._id === editingId) || {}}
              groups={groups}
              onSave={handleSaveTask}
              onCancel={() => setEditingId(null)}
              saving={saving}
            />
          )}

          <div className="admin-table-wrap" style={{ marginTop: editingId ? '1rem' : 0 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Clip</th>
                  {tab === 'tutorial' && <th>Steps</th>}
                  {tab === 'production' && <th>Group</th>}
                  {tab === 'production' && <th>Price</th>}
                  <th>Order</th>
                  <th>Status</th>
                  <th>Ref</th>
                  <th>Subs</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="empty-cell">
                      No {tab} tasks — upload videos and set kind to &quot;{tab}&quot;
                    </td>
                  </tr>
                ) : (
                  tasks.map((t) => (
                    <tr key={t._id}>
                      <td>
                        <strong>{t.title}</strong>
                        {t.description && <p className="table-muted">{t.description}</p>}
                      </td>
                      <td>{t.clipId || '—'}</td>
                      {tab === 'tutorial' && <td>{t.tutorialSteps?.length || 0}</td>}
                      {tab === 'production' && <td>{t.groupId?.name || '—'}</td>}
                      {tab === 'production' && <td>{t.taskPrice != null ? formatMoney(t.taskPrice) : '—'}</td>}
                      <td>{t.sortOrder ?? 0}</td>
                      <td>{t.status}</td>
                      <td>{t.hasReference ? '✓' : '—'}</td>
                      <td>{t.submissionCount ?? 0}</td>
                      <td>{formatTimestamp(t.createdAt)}</td>
                      <td>{formatTimestamp(t.updatedAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEditingId(t._id)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
