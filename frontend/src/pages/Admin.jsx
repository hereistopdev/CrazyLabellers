import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [freelancers, setFreelancers] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    description: '',
    videoUrl: '',
    durationSeconds: 30,
  });

  const load = () => {
    Promise.all([api.getAdminStats(), api.getFreelancers(), api.getSubmissions()])
      .then(([s, f, sub]) => {
        setStats(s);
        setFreelancers(f);
        setSubmissions(sub);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const updateStatus = async (id, status) => {
    try {
      await api.updateFreelancerStatus(id, status);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const reviewSubmission = async (id, status) => {
    try {
      await api.reviewSubmission(id, { status, reviewerNotes: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const createAssignment = async (e) => {
    e.preventDefault();
    try {
      await api.createAssignment(newAssignment);
      setNewAssignment({ title: '', description: '', videoUrl: '', durationSeconds: 30 });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="loading">Loading admin panel...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Admin Dashboard</h1>
        <p>Manage freelancers, review submissions, and add video assignments.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {stats && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="value">{stats.freelancerCount}</div>
            <div className="label">Freelancers</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.passedTestCount}</div>
            <div className="label">Passed test</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.assignmentCount}</div>
            <div className="label">Assignments</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.submissionCount}</div>
            <div className="label">Pending submissions</div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Add video assignment</h3>
        <form onSubmit={createAssignment}>
          <div className="form-group">
            <label>Title</label>
            <input
              value={newAssignment.title}
              onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <input
              value={newAssignment.description}
              onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Video URL</label>
            <input
              value={newAssignment.videoUrl}
              onChange={(e) => setNewAssignment({ ...newAssignment, videoUrl: e.target.value })}
              required
              placeholder="https://..."
            />
          </div>
          <div className="form-group">
            <label>Duration (seconds)</label>
            <input
              type="number"
              value={newAssignment.durationSeconds}
              onChange={(e) =>
                setNewAssignment({ ...newAssignment, durationSeconds: parseInt(e.target.value, 10) })
              }
            />
          </div>
          <button type="submit" className="btn btn-primary btn-sm">
            Create assignment
          </button>
        </form>
      </div>

      <h2 style={{ fontSize: '1.15rem', marginBottom: '0.75rem' }}>Freelancers</h2>
      <div className="card table-wrap" style={{ marginBottom: '2rem' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Best score</th>
              <th>Attempts</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {freelancers.map((f) => (
              <tr key={f._id}>
                <td>{f.name}</td>
                <td>{f.email}</td>
                <td>
                  <span className={`status-badge status-${f.status}`}>
                    {f.status.replace('_', ' ')}
                  </span>
                </td>
                <td>{f.bestTestScore}%</td>
                <td>{f.testAttempts}</td>
                <td>
                  {f.status === 'passed_test' && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => updateStatus(f._id, 'approved')}
                    >
                      Approve
                    </button>
                  )}
                  {f.status !== 'rejected' && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ marginLeft: 4 }}
                      onClick={() => updateStatus(f._id, 'rejected')}
                    >
                      Reject
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: '1.15rem', marginBottom: '0.75rem' }}>Submissions to review</h2>
      <div className="card table-wrap">
        {submissions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No pending submissions</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Video</th>
                <th>Labeler</th>
                <th>Events</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s._id}>
                  <td>{s.assignmentId?.title || '—'}</td>
                  <td>{s.userId?.name}</td>
                  <td>{s.events?.length || 0}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => reviewSubmission(s._id, 'approved')}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ marginLeft: 4 }}
                      onClick={() => reviewSubmission(s._id, 'rejected')}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
