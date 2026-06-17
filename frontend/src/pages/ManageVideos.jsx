import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const STATUS_LABELS = {
  available: 'Available',
  assigned: 'Assigned',
  in_progress: 'In progress',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

export default function ManageVideos() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [meta, setMeta] = useState({ title: '', description: '', gameTime: '1 - 00:00', durationSeconds: 30 });

  const load = () => {
    setLoading(true);
    api
      .getAdminAssignments()
      .then(setVideos)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const uploadVideo = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Choose an .mp4 file to upload');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('video', file);
      if (meta.title) formData.append('title', meta.title);
      if (meta.description) formData.append('description', meta.description);
      formData.append('gameTime', meta.gameTime);
      formData.append('durationSeconds', String(meta.durationSeconds));

      await api.uploadVideo(formData);
      setFile(null);
      setMeta({ title: '', description: '', gameTime: '1 - 00:00', durationSeconds: 30 });
      setMessage('Video added successfully');
      load();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const importFromFolder = async () => {
    setImporting(true);
    setError('');
    try {
      const result = await api.importClips();
      setMessage(`Imported ${result.created} new video(s) from folder (${result.skipped} skipped)`);
      load();
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const removeVideo = async (video) => {
    const label = video.clipId || video.title;
    const confirmed = video.clipId
      ? window.confirm(
          `Remove "${label}"?\n\nThis deletes the assignment and removes the .mp4 from the data folder.`
        )
      : window.confirm(`Remove "${label}"?\n\nThis deletes the assignment only (external URL).`);

    if (!confirmed) return;

    try {
      await api.deleteVideo(video._id, Boolean(video.clipId));
      setMessage('Video removed');
      load();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="loading">Loading videos...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Manage Videos</h1>
        <p>Upload, import, or remove football clips for labeling.</p>
        <div className="actions-row" style={{ marginTop: '0.5rem' }}>
          <Link to="/admin" className="btn btn-secondary btn-sm">
            Back to reviews
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Add video</h3>
        <form onSubmit={uploadVideo}>
          <div className="form-group">
            <label>Video file (.mp4)</label>
            <input
              type="file"
              accept="video/mp4,.mp4"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Filename can be the clip ID (30 hex chars). Otherwise a new ID is generated automatically.
            </p>
          </div>
          <div className="form-group">
            <label>Title (optional)</label>
            <input
              value={meta.title}
              onChange={(e) => setMeta({ ...meta, title: e.target.value })}
              placeholder="Defaults to clip ID"
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <input
              value={meta.description}
              onChange={(e) => setMeta({ ...meta, description: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Game time</label>
            <input
              value={meta.gameTime}
              onChange={(e) => setMeta({ ...meta, gameTime: e.target.value })}
              placeholder="1 - 00:00"
            />
          </div>
          <div className="form-group">
            <label>Duration (seconds)</label>
            <input
              type="number"
              value={meta.durationSeconds}
              onChange={(e) => setMeta({ ...meta, durationSeconds: parseInt(e.target.value, 10) || 30 })}
            />
          </div>
          <div className="actions-row">
            <button type="submit" className="btn btn-primary btn-sm" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload video'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={importFromFolder}
              disabled={importing}
            >
              {importing ? 'Scanning...' : 'Import from data folder'}
            </button>
          </div>
        </form>
      </div>

      <h2 style={{ fontSize: '1.15rem', marginBottom: '0.75rem' }}>Videos ({videos.length})</h2>
      <div className="card table-wrap">
        {videos.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem' }}>
            No videos yet. Upload a clip or import from the data folder.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Clip ID</th>
                <th>Title</th>
                <th>Status</th>
                <th>Assigned to</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((video) => (
                <tr key={video._id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{video.clipId || '—'}</td>
                  <td>{video.title}</td>
                  <td>
                    <span className={`status-badge status-${video.status}`}>
                      {STATUS_LABELS[video.status] || video.status}
                    </span>
                  </td>
                  <td>{video.assignedTo?.name || '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removeVideo(video)}
                    >
                      Remove
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
