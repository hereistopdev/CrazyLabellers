import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useTableData } from '../hooks/useTableData';
import TableToolbar from '../components/TableToolbar';
import Pagination from '../components/Pagination';

const EMPTY_FORM = { name: '', email: '', password: '' };

export default function ManageValidators() {
  const [validators, setValidators] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newValidator, setNewValidator] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadValidators = () => {
    setLoading(true);
    api
      .getValidators()
      .then(setValidators)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadValidators, []);

  const validatorTable = useTableData(validators, {
    searchKeys: ['name', 'email', 'role', 'status'],
    pageSize: 25,
  });

  const updateStatus = async (id, status) => {
    try {
      await api.updateValidatorStatus(id, status);
      setMessage(status === 'approved' ? 'Validator approved' : 'Validator status updated');
      loadValidators();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const addValidator = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createValidator(newValidator);
      setNewValidator(EMPTY_FORM);
      setShowAddForm(false);
      setMessage('Validator added successfully');
      loadValidators();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeValidator = async (id, name) => {
    if (!window.confirm(`Remove validator "${name}"? This cannot be undone.`)) return;

    try {
      await api.deleteValidator(id);
      setMessage('Validator removed');
      loadValidators();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading && validators.length === 0) {
    return <div className="loading">Loading validators...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Manage Validators</h1>
        <p>
          Validators review submitted production tasks, compare labeller work to reference
          annotations, and assign scores (0–100). Self-registered validators start as{' '}
          <strong>pending</strong> until you approve them.
        </p>
        <p className="page-sub-link">
          Sign-up: <Link to="/register?role=validator">Validator register</Link> · Login:{' '}
          <code>/login</code>
        </p>
        <div className="actions-row" style={{ marginTop: '0.5rem' }}>
          <Link to="/admin/labellers" className="btn btn-secondary btn-sm">
            Manage labellers
          </Link>
          <Link to="/admin" className="btn btn-secondary btn-sm">
            Admin dashboard
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="admin-toolbar">
        <span className="toolbar-count">{validators.length} validator(s)</span>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddForm((v) => !v)}
        >
          {showAddForm ? 'Cancel' : '+ Add validator'}
        </button>
      </div>

      {showAddForm && (
        <div className="card add-labeller-form" style={{ marginBottom: '1.5rem' }}>
          <h3>Add validator</h3>
          <p className="form-hint">
            Admin-created validators are approved immediately. They sign in at the login page and
            open the review queue to score submitted tasks.
          </p>
          <form onSubmit={addValidator}>
            <div className="form-row">
              <div className="form-group">
                <label>Full name</label>
                <input
                  value={newValidator.name}
                  onChange={(e) => setNewValidator({ ...newValidator, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={newValidator.email}
                  onChange={(e) => setNewValidator({ ...newValidator, email: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={newValidator.password}
                  onChange={(e) => setNewValidator({ ...newValidator, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Adding...' : 'Add validator'}
            </button>
          </form>
        </div>
      )}

      <div className="card table-wrap">
        <TableToolbar
          search={validatorTable.search}
          onSearchChange={validatorTable.setSearch}
          searchPlaceholder="Search validators…"
          totalCount={validators.length}
          filteredCount={validatorTable.totalCount}
        />
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {validators.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ color: 'var(--text-muted)' }}>
                  No validators yet. Add one to review submitted tasks.
                </td>
              </tr>
            ) : validatorTable.totalCount === 0 ? (
              <tr>
                <td colSpan={6} style={{ color: 'var(--text-muted)' }}>
                  No validators match your search
                </td>
              </tr>
            ) : (
              validatorTable.paginated.map((v) => (
                <tr key={v._id}>
                  <td>{v.name}</td>
                  <td>{v.email}</td>
                  <td>{v.role === 'checker' ? 'Validator (legacy)' : 'Validator'}</td>
                  <td>
                    <span className={`status-badge status-${v.status || 'pending'}`}>
                      {(v.status || 'pending').replace('_', ' ')}
                    </span>
                  </td>
                  <td>{new Date(v.createdAt).toLocaleDateString()}</td>
                  <td>
                    {v.status !== 'approved' && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => updateStatus(v._id, 'approved')}
                      >
                        Approve
                      </button>
                    )}
                    {v.status === 'pending' && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        style={{ marginLeft: 4 }}
                        onClick={() => updateStatus(v._id, 'rejected')}
                      >
                        Reject
                      </button>
                    )}
                    {v.status === 'rejected' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ marginLeft: 4 }}
                        onClick={() => updateStatus(v._id, 'pending')}
                      >
                        Reset
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ marginLeft: 4 }}
                      onClick={() => removeValidator(v._id, v.name)}
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
          page={validatorTable.page}
          totalPages={validatorTable.totalPages}
          pageSize={validatorTable.pageSize}
          onPageChange={validatorTable.setPage}
          onPageSizeChange={validatorTable.setPageSize}
          totalCount={validatorTable.totalCount}
        />
      </div>
    </div>
  );
}
