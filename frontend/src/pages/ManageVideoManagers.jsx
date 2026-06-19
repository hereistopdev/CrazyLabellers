import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useTableData } from '../hooks/useTableData';
import TableToolbar from '../components/TableToolbar';
import Pagination from '../components/Pagination';

const EMPTY_FORM = { name: '', email: '', password: '' };

export default function ManageVideoManagers() {
  const [managers, setManagers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newManager, setNewManager] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadManagers = () => {
    setLoading(true);
    api
      .getVideoManagers()
      .then(setManagers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadManagers, []);

  const managerTable = useTableData(managers, {
    searchKeys: ['name', 'email', 'status'],
    pageSize: 25,
  });

  const updateStatus = async (id, status) => {
    try {
      await api.updateVideoManagerStatus(id, status);
      setMessage(status === 'approved' ? 'Video manager approved' : 'Status updated');
      loadManagers();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const addManager = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createVideoManager(newManager);
      setNewManager(EMPTY_FORM);
      setShowAddForm(false);
      setMessage('Video manager added successfully');
      loadManagers();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeManager = async (id, name) => {
    if (!window.confirm(`Remove video manager "${name}"? This cannot be undone.`)) return;

    try {
      await api.deleteVideoManager(id);
      setMessage('Video manager removed');
      loadManagers();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading && managers.length === 0) {
    return <div className="loading">Loading video managers...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Manage Video Managers</h1>
        <p>
          Video managers upload clips and reference JSON files. Self-registered managers start as{' '}
          <strong>pending</strong> until you approve them.
        </p>
        <p className="page-sub-link">
          Sign-up: <Link to="/register?role=manager">Manager register</Link> · Login:{' '}
          <code>/login</code>
        </p>
        <div className="actions-row" style={{ marginTop: '0.5rem' }}>
          <Link to="/admin/videos" className="btn btn-secondary btn-sm">
            Manage videos
          </Link>
          <Link to="/admin" className="btn btn-secondary btn-sm">
            Admin dashboard
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="admin-toolbar">
        <span className="toolbar-count">{managers.length} manager(s)</span>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddForm((v) => !v)}
        >
          {showAddForm ? 'Cancel' : '+ Add manager'}
        </button>
      </div>

      {showAddForm && (
        <div className="card add-labeller-form" style={{ marginBottom: '1.5rem' }}>
          <h3>Add video manager</h3>
          <p className="form-hint">
            Admin-created managers are approved immediately. They sign in and open Manage Videos to
            upload clips and reference JSON.
          </p>
          <form onSubmit={addManager}>
            <div className="form-row">
              <div className="form-group">
                <label>Full name</label>
                <input
                  value={newManager.name}
                  onChange={(e) => setNewManager({ ...newManager, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={newManager.email}
                  onChange={(e) => setNewManager({ ...newManager, email: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={newManager.password}
                  onChange={(e) => setNewManager({ ...newManager, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Adding...' : 'Add manager'}
            </button>
          </form>
        </div>
      )}

      <div className="card table-wrap">
        <TableToolbar
          search={managerTable.search}
          onSearchChange={managerTable.setSearch}
          searchPlaceholder="Search managers…"
          totalCount={managers.length}
          filteredCount={managerTable.totalCount}
        />
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {managers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: 'var(--text-muted)' }}>
                  No video managers yet. Add one or share the manager register link.
                </td>
              </tr>
            ) : managerTable.totalCount === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: 'var(--text-muted)' }}>
                  No managers match your search
                </td>
              </tr>
            ) : (
              managerTable.paginated.map((m) => (
                <tr key={m._id}>
                  <td>{m.name}</td>
                  <td>{m.email}</td>
                  <td>
                    <span className={`status-badge status-${m.status || 'pending'}`}>
                      {(m.status || 'pending').replace('_', ' ')}
                    </span>
                  </td>
                  <td>{new Date(m.createdAt).toLocaleDateString()}</td>
                  <td>
                    {m.status !== 'approved' && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => updateStatus(m._id, 'approved')}
                      >
                        Approve
                      </button>
                    )}
                    {m.status === 'pending' && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        style={{ marginLeft: 4 }}
                        onClick={() => updateStatus(m._id, 'rejected')}
                      >
                        Reject
                      </button>
                    )}
                    {m.status === 'rejected' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ marginLeft: 4 }}
                        onClick={() => updateStatus(m._id, 'pending')}
                      >
                        Reset
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ marginLeft: 4 }}
                      onClick={() => removeManager(m._id, m.name)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination
          page={managerTable.page}
          totalPages={managerTable.totalPages}
          pageSize={managerTable.pageSize}
          onPageChange={managerTable.setPage}
          onPageSizeChange={managerTable.setPageSize}
          totalCount={managerTable.totalCount}
        />
      </div>
    </div>
  );
}
