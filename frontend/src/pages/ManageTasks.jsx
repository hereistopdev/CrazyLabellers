import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdmin, isVideoManager } from '../utils/roles';
import { api } from '../api';
import { formatTimestamp } from '../utils/formatTimestamp';
import { formatMoney, isFreeTaskKind } from '../utils/money';
import VideoLabelLink from '../components/VideoLabelLink';
import { openLabelerRow } from '../utils/labelerAccess';
import { useTableData } from '../hooks/useTableData';
import TableToolbar from '../components/TableToolbar';
import Pagination from '../components/Pagination';
import AssignmentStatusBadge from '../components/AssignmentStatusBadge';
import { ASSIGNMENT_STATUS_LABELS } from '../utils/assignmentStatus';
import { GROUP_NEW, validateGroupChoice } from '../components/UploadGroupSelect';
import { groupProductionTasks, matchesDateRange } from '../utils/tableFilter';
import DownloadGroupExportButton from '../components/DownloadGroupExportButton';

const MIN_PRICE = 0.3;
const MAX_PRICE = 2;

const TASK_KINDS = [
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'pretest', label: 'Pre-test' },
  { value: 'production', label: 'Real task' },
];

const TASK_KIND_LABELS = Object.fromEntries(TASK_KINDS.map((k) => [k.value, k.label]));

const KIND_TABS = [
  { id: 'groups', label: 'Groups' },
  { id: 'tutorial', label: 'Tutorial' },
  { id: 'pretest', label: 'Pre-test' },
  { id: 'production', label: 'Real tasks' },
];

const MANAGER_TABS = KIND_TABS.filter((t) => t.id === 'groups' || t.id === 'production');

const EMPTY_STEP = { frameTime: 0, eventType: '', title: '', explanation: '' };

const PRODUCTION_FILTERS = {
  group: 'all',
  status: 'all',
  priceMin: '',
  priceMax: '',
  dateFrom: '',
  dateTo: '',
  sortBy: 'createdAt',
  sortDir: 'desc',
};

function filterProductionTasks(items, filters) {
  return items.filter((task) => {
    const groupKey = task.groupId?._id || task.groupId || 'ungrouped';
    if (filters.group !== 'all') {
      if (filters.group === 'ungrouped' && groupKey !== 'ungrouped') return false;
      if (filters.group !== 'ungrouped' && String(groupKey) !== filters.group) return false;
    }
    if (filters.status !== 'all' && task.status !== filters.status) return false;
    const price = task.taskPrice ?? 0;
    if (filters.priceMin !== '' && price < parseFloat(filters.priceMin)) return false;
    if (filters.priceMax !== '' && price > parseFloat(filters.priceMax)) return false;
    if (!matchesDateRange(task.createdAt, filters.dateFrom, filters.dateTo)) return false;
    return true;
  });
}

function sortProductionTasks(items, filters) {
  const dir = filters.sortDir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    if (filters.sortBy === 'price') {
      return ((a.taskPrice ?? 0) - (b.taskPrice ?? 0)) * dir;
    }
    if (filters.sortBy === 'title') {
      return a.title.localeCompare(b.title) * dir;
    }
    if (filters.sortBy === 'updatedAt') {
      return (new Date(a.updatedAt) - new Date(b.updatedAt)) * dir;
    }
    return (new Date(a.createdAt) - new Date(b.createdAt)) * dir;
  });
}

function TaskRow({ task, tab, navigate, onEdit, selectable = false, selected = false, onToggleSelect }) {
  return (
    <tr className="table-row-link" onClick={(e) => openLabelerRow(navigate, task._id, e)}>
      {selectable && (
        <td onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(task._id)}
          />
        </td>
      )}
      <td>
        <VideoLabelLink assignmentId={task._id}>
          <strong>{task.title}</strong>
        </VideoLabelLink>
        {task.description && <p className="table-muted">{task.description}</p>}
      </td>
      <td>{task.clipId || '—'}</td>
      {tab === 'tutorial' && <td>{task.tutorialSteps?.length || 0}</td>}
      {tab === 'production' && <td>{task.groupId?.name || '—'}</td>}
      {tab === 'production' && (
        <td>{task.taskPrice != null ? formatMoney(task.taskPrice) : '—'}</td>
      )}
      <td>{task.sortOrder ?? 0}</td>
      <td>
        <AssignmentStatusBadge status={task.status} />
      </td>
      <td>{task.hasReference ? '✓' : '—'}</td>
      <td>{task.submissionCount ?? 0}</td>
      <td>{formatTimestamp(task.createdAt)}</td>
      <td>{formatTimestamp(task.updatedAt)}</td>
      <td>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(task._id);
          }}
        >
          Edit metadata
        </button>{' '}
        <VideoLabelLink assignmentId={task._id} className="btn btn-primary btn-sm">
          Open labeler
        </VideoLabelLink>
      </td>
    </tr>
  );
}

function TaskEditor({ task, groups, onSave, onCancel, saving, adminUser = true }) {
  const [form, setForm] = useState({
    title: task.title || '',
    description: task.description || '',
    kind: task.kind || 'production',
    sortOrder: task.sortOrder ?? 0,
    groupId: task.groupId?._id || task.groupId || '',
    taskPrice: task.taskPrice ?? 1,
    challengeNote: task.challengeNote || '',
    allowLabellerReference: Boolean(task.allowLabellerReference),
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
      taskPrice: isFreeTaskKind(form.kind) ? 0 : Number(form.taskPrice),
      challengeNote: form.challengeNote,
      allowLabellerReference: form.kind === 'production' ? form.allowLabellerReference : false,
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
          <select
            value={form.kind}
            disabled={!adminUser}
            onChange={(e) => {
              const kind = e.target.value;
              setForm({
                ...form,
                kind,
                taskPrice: isFreeTaskKind(kind) ? 0 : form.taskPrice || 1,
              });
            }}
          >
            {adminUser && <option value="tutorial">Tutorial</option>}
            {adminUser && <option value="pretest">Pre-test</option>}
            <option value="production">Real task</option>
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
            {adminUser && (
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
            )}
            <label className="form-grid-full">
              Challenge note
              <input
                value={form.challengeNote}
                onChange={(e) => setForm({ ...form, challengeNote: e.target.value })}
              />
            </label>
            <label className="form-grid-full review-checkbox-label">
              <input
                type="checkbox"
                checked={form.allowLabellerReference}
                onChange={(e) =>
                  setForm({ ...form, allowLabellerReference: e.target.checked })
                }
              />
              Allow labellers to view reference and label by comparison (for updated criteria / re-label tasks)
            </label>
          </>
        )}
        {(form.kind === 'tutorial' || form.kind === 'pretest') && (
          <p className="form-grid-full" style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            {form.kind === 'tutorial' ? 'Tutorial' : 'Pre-test'} clips are free for labellers (
            {formatMoney(0)}).
          </p>
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const adminUser = isAdmin(user);
  const managerUser = isAdmin(user) || isVideoManager(user);
  const tabOptions = adminUser ? KIND_TABS : MANAGER_TABS;
  const [tab, setTab] = useState(adminUser ? 'tutorial' : 'groups');
  const [groups, setGroups] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', description: '', sortOrder: 0 });
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkKind, setBulkKind] = useState('production');
  const [bulkPrice, setBulkPrice] = useState(1);
  const [bulkChallenge, setBulkChallenge] = useState('');
  const [bulkGroupChoice, setBulkGroupChoice] = useState('');
  const [bulkNewGroupName, setBulkNewGroupName] = useState('');
  const [savingBulkKind, setSavingBulkKind] = useState(false);
  const [savingBulkPrice, setSavingBulkPrice] = useState(false);
  const [savingBulkGroup, setSavingBulkGroup] = useState(false);

  const loadGroups = ({ silent = false } = {}) => {
    if (!silent) {
      setGroupsLoading(true);
    }
    return api
      .getTaskGroups()
      .then(setGroups)
      .catch((err) => setError(err.message))
      .finally(() => {
        if (!silent) {
          setGroupsLoading(false);
        }
      });
  };

  const loadTasks = (kind, { silent = false } = {}) => {
    if (kind === 'groups') return Promise.resolve([]);
    if (!silent) {
      setTasksLoading(true);
    }
    return api
      .getAdminTasks({ kind })
      .then(setTasks)
      .catch((err) => setError(err.message))
      .finally(() => {
        if (!silent) {
          setTasksLoading(false);
        }
      });
  };

  useEffect(() => {
    loadGroups({ silent: true });
  }, []);

  useEffect(() => {
    setError('');
    if (tab === 'groups') {
      loadGroups();
    } else {
      loadTasks(tab);
    }
  }, [tab]);

  useEffect(() => {
    setSelectedIds([]);
  }, [tab]);

  const handleSaveTask = async (body) => {
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateAdminTask(editingId, body);
      setTasks((prev) => {
        const existing = prev.find((task) => task._id === editingId);
        if (!existing) return prev;

        const merged = {
          ...existing,
          ...updated,
          hasReference: existing.hasReference,
          submissionCount: existing.submissionCount,
        };

        if (merged.kind !== tab) {
          return prev.filter((task) => task._id !== editingId);
        }
        return prev.map((task) => (task._id === editingId ? merged : task));
      });
      setMessage('Task updated');
      setEditingId(null);
      if (body.groupId !== undefined) {
        loadGroups({ silent: true });
      }
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const applyBulkKind = async () => {
    if (selectedIds.length === 0) {
      setError('Select at least one task');
      return;
    }
    setSavingBulkKind(true);
    setError('');
    try {
      await Promise.all(selectedIds.map((id) => api.updateAdminTask(id, { kind: bulkKind })));
      setTasks((prev) => {
        const next = prev.map((task) =>
          selectedIds.includes(task._id)
            ? {
                ...task,
                kind: bulkKind,
                taskPrice: isFreeTaskKind(bulkKind) ? 0 : task.taskPrice,
              }
            : task
        );
        return next.filter((task) => !selectedIds.includes(task._id) || task.kind === tab);
      });
      setSelectedIds([]);
      setMessage(`Set ${selectedIds.length} task(s) to ${TASK_KIND_LABELS[bulkKind] || bulkKind}`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingBulkKind(false);
    }
  };

  const applyBulkPrice = async () => {
    if (selectedIds.length === 0) {
      setError('Select at least one task');
      return;
    }
    setSavingBulkPrice(true);
    setError('');
    try {
      await api.bulkUpdateAssignmentPrice({
        assignmentIds: selectedIds,
        taskPrice: bulkPrice,
        challengeNote: bulkChallenge,
      });
      setTasks((prev) =>
        prev.map((task) =>
          selectedIds.includes(task._id) && !isFreeTaskKind(task.kind)
            ? { ...task, taskPrice: bulkPrice, challengeNote: bulkChallenge }
            : task
        )
      );
      setSelectedIds([]);
      setMessage(`Updated price for ${selectedIds.length} task(s)`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingBulkPrice(false);
    }
  };

  const applyBulkGroup = async () => {
    if (selectedIds.length === 0) {
      setError('Select at least one task');
      return;
    }

    const groupError = validateGroupChoice(bulkGroupChoice, bulkNewGroupName);
    if (groupError) {
      setError(groupError);
      return;
    }

    setSavingBulkGroup(true);
    setError('');
    try {
      let groupId = null;
      let groupMeta = null;

      if (bulkGroupChoice === GROUP_NEW && bulkNewGroupName.trim()) {
        const created = await api.createTaskGroup({ name: bulkNewGroupName.trim() });
        groupId = created._id;
        groupMeta = { _id: created._id, name: created.name };
        loadGroups({ silent: true });
      } else if (bulkGroupChoice && bulkGroupChoice !== GROUP_NEW) {
        groupId = bulkGroupChoice;
        const existing = groups.find((group) => group._id === groupId);
        groupMeta = existing ? { _id: existing._id, name: existing.name } : { _id: groupId };
      }

      await Promise.all(selectedIds.map((id) => api.updateAdminTask(id, { groupId })));

      setTasks((prev) =>
        prev.map((task) =>
          selectedIds.includes(task._id) ? { ...task, groupId: groupMeta } : task
        )
      );
      setSelectedIds([]);
      setMessage(`Updated group for ${selectedIds.length} task(s)`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingBulkGroup(false);
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
      setGroups((prev) => prev.filter((group) => group._id !== id));
      if (tab === 'production') {
        setTasks((prev) =>
          prev.map((task) => {
            const groupKey = task.groupId?._id || task.groupId;
            if (groupKey === id) {
              return { ...task, groupId: null };
            }
            return task;
          })
        );
      }
      setMessage('Group deleted');
      setTimeout(() => setMessage(''), 2500);
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

  const groupTable = useTableData(groups, {
    searchKeys: ['name', 'description'],
    pageSize: 25,
  });

  const simpleTaskTable = useTableData(tasks, {
    searchKeys: ['title', 'clipId', 'description'],
    pageSize: 25,
    filterFn: (items, filters) =>
      items.filter((task) => filters.status === 'all' || task.status === filters.status),
    initialFilters: { status: 'all' },
  });

  const productionTable = useTableData(tasks, {
    searchKeys: ['title', 'clipId', 'description', 'groupId.name', 'challengeNote'],
    pageSize: 25,
    filterFn: filterProductionTasks,
    sortFn: sortProductionTasks,
    initialFilters: PRODUCTION_FILTERS,
  });

  const groupedProduction = useMemo(
    () => groupProductionTasks(productionTable.paginated),
    [productionTable.paginated]
  );

  const taskTable = tab === 'production' ? productionTable : simpleTaskTable;

  const pageTaskIds = taskTable.paginated.map((task) => task._id);
  const allPageSelected =
    pageTaskIds.length > 0 && pageTaskIds.every((id) => selectedIds.includes(id));

  const toggleSelectAllPage = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageTaskIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...pageTaskIds])]);
    }
  };

  const showBulkActions = tab !== 'groups' && tasks.length > 0;

  if (tasksLoading && tab !== 'groups' && tasks.length === 0 && groups.length === 0) {
    return <div className="loading">Loading tasks...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Manage tasks</h1>
        <p>
          {adminUser
            ? 'Configure tutorial examples, pre-test clips (3), production groups, and frame explanations. Upload videos from '
            : 'Create production groups and assign uploaded clips to groups. Upload videos from '}
          <Link to="/admin/videos#bulk-upload">Videos (bulk upload)</Link>
          {adminUser ? ', then assign kind and metadata here.' : ', then assign groups here.'}
        </p>
        <div className="actions-row" style={{ marginTop: '0.5rem' }}>
          <Link to="/admin/videos" className="btn btn-secondary btn-sm">
            Manage videos
          </Link>
          {adminUser && (
            <Link to="/admin" className="btn btn-secondary btn-sm">
              Admin dashboard
            </Link>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="tab-bar">
        {tabOptions.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => {
              setTab(t.id);
              setEditingId(null);
              setSelectedIds([]);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'groups' ? (
        <div className="manage-groups">
          {groupsLoading && groups.length === 0 ? (
            <p className="empty-cell">Loading groups…</p>
          ) : (
            <>
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

          <div className="card table-wrap">
            <TableToolbar
              search={groupTable.search}
              onSearchChange={groupTable.setSearch}
              searchPlaceholder="Search groups…"
              totalCount={groups.length}
              filteredCount={groupTable.totalCount}
            />
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
                  ) : groupTable.totalCount === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty-cell">
                        No groups match your search
                      </td>
                    </tr>
                  ) : (
                    groupTable.paginated.map((g) => (
                      <tr key={g._id}>
                        <td>
                          <strong>{g.name}</strong>
                          {g.description && <p className="table-muted">{g.description}</p>}
                        </td>
                        <td>{g.taskCount ?? 0}</td>
                        <td>{g.sortOrder}</td>
                        <td>{formatTimestamp(g.createdAt)}</td>
                        <td>{formatTimestamp(g.updatedAt)}</td>
                        <td>
                          <div className="actions-row">
                            <DownloadGroupExportButton
                              groupId={g._id}
                              groupName={g.name}
                              scope="admin"
                              variant="post"
                              compact
                              label="JSON zip"
                            />
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
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={groupTable.page}
              totalPages={groupTable.totalPages}
              pageSize={groupTable.pageSize}
              onPageChange={groupTable.setPage}
              onPageSizeChange={groupTable.setPageSize}
              totalCount={groupTable.totalCount}
            />
          </div>
            </>
          )}
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
              adminUser={adminUser}
            />
          )}

          {showBulkActions && (
            <div className="card bulk-actions-bar" style={{ marginBottom: '1rem' }}>
              <strong className="bulk-actions-title">
                Bulk actions {selectedIds.length > 0 && `(${selectedIds.length} selected)`}
              </strong>
              {adminUser && (
                <>
                  <div className="bulk-actions-row">
                    <div className="bulk-actions-field">
                      <span>Task type</span>
                      <select
                        value={bulkKind}
                        onChange={(e) => setBulkKind(e.target.value)}
                        className="kind-select field-input--inline"
                      >
                        {TASK_KINDS.map((k) => (
                          <option key={k.value} value={k.value}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="bulk-actions-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={applyBulkKind}
                        disabled={savingBulkKind || selectedIds.length === 0}
                      >
                        {savingBulkKind ? 'Saving...' : 'Apply task type'}
                      </button>
                    </div>
                  </div>
                  {tab === 'production' && (
                    <div className="bulk-actions-row">
                      <div className="bulk-actions-field">
                        <span>Price ($)</span>
                        <input
                          type="number"
                          min={MIN_PRICE}
                          max={MAX_PRICE}
                          step="0.1"
                          value={bulkPrice}
                          onChange={(e) => setBulkPrice(parseFloat(e.target.value) || 1)}
                          className="field-input--inline field-input--number"
                        />
                      </div>
                      <div className="bulk-actions-field bulk-actions-field--grow">
                        <span>Challenge note</span>
                        <input
                          value={bulkChallenge}
                          onChange={(e) => setBulkChallenge(e.target.value)}
                          placeholder="Optional note for labellers"
                          className="field-input--inline field-input--grow"
                        />
                      </div>
                      <div className="bulk-actions-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={applyBulkPrice}
                          disabled={savingBulkPrice || selectedIds.length === 0}
                        >
                          {savingBulkPrice ? 'Saving...' : 'Apply price & note'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
              {tab === 'production' && managerUser && (
                <div className="bulk-actions-row">
                  <div className="bulk-actions-field">
                    <span>Production group</span>
                    <select
                      value={bulkGroupChoice}
                      onChange={(e) => setBulkGroupChoice(e.target.value)}
                      className="field-input--inline"
                    >
                      <option value="">No group</option>
                      {groups.map((group) => (
                        <option key={group._id} value={group._id}>
                          {group.name}
                        </option>
                      ))}
                      <option value={GROUP_NEW}>+ Create new group…</option>
                    </select>
                  </div>
                  {bulkGroupChoice === GROUP_NEW && (
                    <div className="bulk-actions-field bulk-actions-field--grow">
                      <span>New group name</span>
                      <input
                        value={bulkNewGroupName}
                        onChange={(e) => setBulkNewGroupName(e.target.value)}
                        placeholder="Group name"
                        className="field-input--inline field-input--grow"
                      />
                    </div>
                  )}
                  <div className="bulk-actions-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={applyBulkGroup}
                      disabled={savingBulkGroup || selectedIds.length === 0}
                    >
                      {savingBulkGroup ? 'Saving...' : 'Apply group'}
                    </button>
                    {selectedIds.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedIds([])}
                      >
                        Clear selection
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="card table-wrap" style={{ marginTop: editingId ? '1rem' : 0 }}>
            <TableToolbar
              search={taskTable.search}
              onSearchChange={taskTable.setSearch}
              searchPlaceholder="Search title, clip ID, group…"
              totalCount={tasks.length}
              filteredCount={taskTable.totalCount}
            >
              {tab === 'production' ? (
                <>
                  <select
                    className="table-filter-select"
                    value={taskTable.filters.group}
                    onChange={(e) => taskTable.updateFilter('group', e.target.value)}
                  >
                    <option value="all">All groups</option>
                    <option value="ungrouped">Ungrouped</option>
                    {groups.map((g) => (
                      <option key={g._id} value={g._id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="table-filter-select"
                    value={taskTable.filters.status}
                    onChange={(e) => taskTable.updateFilter('status', e.target.value)}
                  >
                    <option value="all">All statuses</option>
                    {Object.entries(ASSIGNMENT_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="table-filter-input table-filter-input--price"
                    placeholder="Min"
                    value={taskTable.filters.priceMin}
                    onChange={(e) => taskTable.updateFilter('priceMin', e.target.value)}
                  />
                  <input
                    type="number"
                    className="table-filter-input table-filter-input--price"
                    placeholder="Max"
                    value={taskTable.filters.priceMax}
                    onChange={(e) => taskTable.updateFilter('priceMax', e.target.value)}
                  />
                  <input
                    type="date"
                    className="table-filter-input table-filter-input--date"
                    value={taskTable.filters.dateFrom}
                    onChange={(e) => taskTable.updateFilter('dateFrom', e.target.value)}
                  />
                  <input
                    type="date"
                    className="table-filter-input table-filter-input--date"
                    value={taskTable.filters.dateTo}
                    onChange={(e) => taskTable.updateFilter('dateTo', e.target.value)}
                  />
                  <select
                    className="table-filter-select"
                    value={taskTable.filters.sortBy}
                    onChange={(e) => taskTable.updateFilter('sortBy', e.target.value)}
                  >
                    <option value="createdAt">Created</option>
                    <option value="updatedAt">Updated</option>
                    <option value="price">Price</option>
                    <option value="title">Title</option>
                  </select>
                  <select
                    className="table-filter-select"
                    value={taskTable.filters.sortDir}
                    onChange={(e) => taskTable.updateFilter('sortDir', e.target.value)}
                  >
                    <option value="desc">Desc</option>
                    <option value="asc">Asc</option>
                  </select>
                </>
              ) : (
                <select
                  className="table-filter-select"
                  value={taskTable.filters.status}
                  onChange={(e) => taskTable.updateFilter('status', e.target.value)}
                >
                  <option value="all">All statuses</option>
                  {Object.entries(ASSIGNMENT_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </TableToolbar>

            {tasksLoading ? (
              <p className="empty-cell">Loading tasks…</p>
            ) : tasks.length === 0 ? (
              <p className="empty-cell">
                No {tab} tasks — upload videos and set kind to &quot;{tab}&quot;
              </p>
            ) : taskTable.totalCount === 0 ? (
              <p className="empty-cell">No tasks match your search or filters</p>
            ) : tab === 'production' ? (
              <>
                {groupedProduction.map((group) => (
                  <div key={group.id} className="production-group-block">
                    <div className="production-group-header">
                      <div>
                        <h3>
                          {group.name}{' '}
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            ({group.tasks.length} on this page)
                          </span>
                        </h3>
                        {group.description && <p className="group-desc">{group.description}</p>}
                      </div>
                      {group.id !== 'ungrouped' && managerUser && (
                        <div className="actions-row">
                          <DownloadGroupExportButton
                            groupId={group.id}
                            groupName={group.name}
                            scope="admin"
                            variant="post"
                          />
                          <DownloadGroupExportButton
                            groupId={group.id}
                            groupName={group.name}
                            scope="admin"
                            variant="raw"
                            compact
                            label="Download _post.json zip"
                          />
                        </div>
                      )}
                    </div>
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            {showBulkActions && (
                              <th>
                                <input
                                  type="checkbox"
                                  checked={allPageSelected}
                                  onChange={toggleSelectAllPage}
                                  title="Select all on this page"
                                />
                              </th>
                            )}
                            <th>Title</th>
                            <th>Clip</th>
                            <th>Price</th>
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
                          {group.tasks.map((t) => (
                            <TaskRow
                              key={t._id}
                              task={t}
                              tab={tab}
                              navigate={navigate}
                              onEdit={setEditingId}
                              selectable={showBulkActions}
                              selected={selectedIds.includes(t._id)}
                              onToggleSelect={toggleSelect}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
                <Pagination
                  page={taskTable.page}
                  totalPages={taskTable.totalPages}
                  pageSize={taskTable.pageSize}
                  onPageChange={taskTable.setPage}
                  onPageSizeChange={taskTable.setPageSize}
                  totalCount={taskTable.totalCount}
                />
              </>
            ) : (
              <>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        {showBulkActions && (
                          <th>
                            <input
                              type="checkbox"
                              checked={allPageSelected}
                              onChange={toggleSelectAllPage}
                              title="Select all on this page"
                            />
                          </th>
                        )}
                        <th>Title</th>
                        <th>Clip</th>
                        {tab === 'tutorial' && <th>Steps</th>}
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
                      {taskTable.paginated.map((t) => (
                        <TaskRow
                          key={t._id}
                          task={t}
                          tab={tab}
                          navigate={navigate}
                          onEdit={setEditingId}
                          selectable={showBulkActions}
                          selected={selectedIds.includes(t._id)}
                          onToggleSelect={toggleSelect}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={taskTable.page}
                  totalPages={taskTable.totalPages}
                  pageSize={taskTable.pageSize}
                  onPageChange={taskTable.setPage}
                  onPageSizeChange={taskTable.setPageSize}
                  totalCount={taskTable.totalCount}
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
