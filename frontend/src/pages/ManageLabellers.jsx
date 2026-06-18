import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import StarRating from '../components/StarRating';
import { LABELLER_STATUSES } from '../utils/roles';
import { useTableData } from '../hooks/useTableData';
import TableToolbar from '../components/TableToolbar';
import Pagination from '../components/Pagination';

const EMPTY_FORM = { name: '', email: '', password: '', status: 'pending' };

export default function ManageLabellers() {
  const [labellers, setLabellers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabeller, setNewLabeller] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [assignTo, setAssignTo] = useState('');

  const loadLabellers = () => {
    setLoading(true);
    api
      .getLabellers(statusFilter || undefined)
      .then(setLabellers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadLabellers, [statusFilter]);

  useEffect(() => {
    api.getAdminAssignments().then(setAssignments).catch(() => {});
  }, []);

  const openDetail = async (id) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await api.getLabeller(id);
      setDetail(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.updateLabellerStatus(id, status);
      loadLabellers();
      if (selectedId === id) openDetail(id);
    } catch (err) {
      setError(err.message);
    }
  };

  const addLabeller = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createLabeller(newLabeller);
      setNewLabeller(EMPTY_FORM);
      setShowAddForm(false);
      setMessage('Labeller added successfully');
      loadLabellers();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeLabeller = async (id, name) => {
    if (!window.confirm(`Remove labeller "${name}"? This cannot be undone.`)) return;

    try {
      await api.deleteLabeller(id);
      if (selectedId === id) {
        setSelectedId(null);
        setDetail(null);
      }
      setMessage('Labeller removed');
      loadLabellers();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const assignVideo = async () => {
    if (!selectedId || !assignTo) return;
    try {
      await api.assignToLabeller(selectedId, assignTo);
      setAssignTo('');
      openDetail(selectedId);
      loadLabellers();
    } catch (err) {
      setError(err.message);
    }
  };

  const labellerTable = useTableData(labellers, {
    searchKeys: ['name', 'email', 'status'],
    pageSize: 25,
  });

  if (loading && labellers.length === 0) {
    return <div className="loading">Loading labellers...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Manage Labellers</h1>
        <p>Add, remove, approve, and assign work to labellers.</p>
        <p className="page-sub-link">
          Labeller sign-up: <code>/register</code> · Labeller login: <code>/login</code>
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="admin-toolbar">
        <label>
          Filter by status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {LABELLER_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <span className="toolbar-count">{labellers.length} labeller(s)</span>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddForm((v) => !v)}
        >
          {showAddForm ? 'Cancel' : '+ Add labeller'}
        </button>
      </div>

      {showAddForm && (
        <div className="card add-labeller-form" style={{ marginBottom: '1.5rem' }}>
          <h3>Add labeller manually</h3>
          <p className="form-hint">
            Create an account for a labeller. They can sign in at the login page with these credentials.
          </p>
          <form onSubmit={addLabeller}>
            <div className="form-row">
              <div className="form-group">
                <label>Full name</label>
                <input
                  value={newLabeller.name}
                  onChange={(e) => setNewLabeller({ ...newLabeller, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={newLabeller.email}
                  onChange={(e) => setNewLabeller({ ...newLabeller, email: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={newLabeller.password}
                  onChange={(e) => setNewLabeller({ ...newLabeller, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <label>Initial status</label>
                <select
                  value={newLabeller.status}
                  onChange={(e) => setNewLabeller({ ...newLabeller, status: e.target.value })}
                >
                  <option value="pending">Pending</option>
                  <option value="passed_test">Passed test</option>
                  <option value="approved">Approved</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Adding...' : 'Add labeller'}
            </button>
          </form>
        </div>
      )}

      <div className="labeller-layout">
        <div className="card table-wrap">
          <TableToolbar
            search={labellerTable.search}
            onSearchChange={labellerTable.setSearch}
            searchPlaceholder="Search name or email…"
            totalCount={labellers.length}
            filteredCount={labellerTable.totalCount}
          />
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {labellers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--text-muted)' }}>
                    No labellers yet. Add one manually or share the register page.
                  </td>
                </tr>
              ) : labellerTable.totalCount === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--text-muted)' }}>
                    No labellers match your search
                  </td>
                </tr>
              ) : (
                labellerTable.paginated.map((l) => (
                  <tr
                    key={l._id}
                    className={selectedId === l._id ? 'row-selected' : ''}
                    onClick={() => openDetail(l._id)}
                  >
                    <td>{l.name}</td>
                    <td>{l.email}</td>
                    <td>
                      <span className={`status-badge status-${l.status}`}>
                        {l.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{l.bestTestScore}%</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {(l.status === 'pending' || l.status === 'passed_test') && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => updateStatus(l._id, 'approved')}
                          title="Manually approve labeller"
                        >
                          {l.status === 'pending' ? 'Approve manually' : 'Approve'}
                        </button>
                      )}
                      {l.status === 'rejected' && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => updateStatus(l._id, 'pending')}
                        >
                          Reset
                        </button>
                      )}
                      {l.status !== 'rejected' && l.status !== 'approved' && (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          style={{ marginLeft: 4 }}
                          onClick={() => updateStatus(l._id, 'rejected')}
                        >
                          Reject
                        </button>
                      )}
                      {l.status === 'approved' && (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          style={{ marginLeft: 4 }}
                          onClick={() => updateStatus(l._id, 'rejected')}
                        >
                          Revoke
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        style={{ marginLeft: 4 }}
                        onClick={() => removeLabeller(l._id, l.name)}
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
            page={labellerTable.page}
            totalPages={labellerTable.totalPages}
            pageSize={labellerTable.pageSize}
            onPageChange={labellerTable.setPage}
            onPageSizeChange={labellerTable.setPageSize}
            totalCount={labellerTable.totalCount}
          />
        </div>

        <div className="labeller-detail card">
          {!selectedId ? (
            <p className="empty-detail">Select a labeller to view details</p>
          ) : detailLoading ? (
            <p>Loading...</p>
          ) : detail ? (
            <>
              <div className="detail-header">
                <div>
                  <h3>{detail.labeller.name}</h3>
                  <p className="detail-email">{detail.labeller.email}</p>
                  <Link to={`/profile/${detail.labeller._id}`} className="btn btn-secondary btn-sm">
                    View work profile
                  </Link>
                </div>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removeLabeller(detail.labeller._id, detail.labeller.name)}
                >
                  Remove
                </button>
              </div>

              <div className="detail-stats">
                <div>
                  <StarRating value={Math.round(detail.labeller.avgRating || 0)} readOnly size="sm" />
                  <strong>{detail.labeller.avgRating || '—'}</strong>
                  <span>{detail.labeller.reviewCount || 0} reviews</span>
                </div>
                <div>
                  <strong>{detail.labeller.jobsCompleted || 0}</strong>
                  <span>Jobs done</span>
                </div>
                <div>
                  <strong>{detail.labeller.bestTestScore}%</strong>
                  <span>Best score</span>
                </div>
                <div>
                  <strong>{detail.labeller.testAttempts}</strong>
                  <span>Test attempts</span>
                </div>
                <div>
                  <strong>{detail.assignmentsClaimed}</strong>
                  <span>Assignments</span>
                </div>
              </div>

              <div className="detail-actions">
                {(detail.labeller.status === 'passed_test' || detail.labeller.status === 'pending') && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => updateStatus(detail.labeller._id, 'approved')}
                  >
                    {detail.labeller.status === 'pending' ? 'Approve manually' : 'Approve labeller'}
                  </button>
                )}
                {detail.labeller.status === 'pending' && (
                  <span className="detail-hint" style={{ marginLeft: 8 }}>
                    Can approve without test
                  </span>
                )}
              </div>

              {['passed_test', 'approved'].includes(detail.labeller.status) && (
                <div className="assign-box">
                  <h4>Assign video</h4>
                  <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                    <option value="">Select assignment...</option>
                    {assignments
                      .filter(
                        (a) =>
                          a.kind === 'production' &&
                          (a.status === 'available' || !a.assignedTo)
                      )
                      .map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.title}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={assignVideo}
                    disabled={!assignTo}
                  >
                    Assign
                  </button>
                </div>
              )}

              <h4>Recent test results</h4>
              {detail.testResults.length === 0 ? (
                <p className="detail-muted">No tests taken yet</p>
              ) : (
                <ul className="detail-list">
                  {detail.testResults.map((t) => (
                    <li key={t._id}>
                      {t.score}% — {t.passed ? 'Passed' : 'Failed'} (
                      {new Date(t.createdAt).toLocaleDateString()})
                    </li>
                  ))}
                </ul>
              )}

              <h4>Submissions</h4>
              {detail.submissions.length === 0 ? (
                <p className="detail-muted">No submissions yet</p>
              ) : (
                <ul className="detail-list">
                  {detail.submissions.map((s) => (
                    <li key={s._id}>
                      {s.assignmentId?.title || 'Video'} — {s.status} ({s.events?.length || 0}{' '}
                      events)
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
