import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { formatMoney } from '../utils/money';
import { readVideoDurationFromFile } from '../utils/videoDuration';
import { formatTimestamp } from '../utils/formatTimestamp';
import VideoLabelLink from '../components/VideoLabelLink';
import { openLabelerRow } from '../utils/labelerAccess';

const MIN_PRICE = 0.3;
const MAX_PRICE = 2;

const TASK_KINDS = [
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'pretest', label: 'Pre-test' },
  { value: 'production', label: 'Real task' },
];

const TASK_KIND_LABELS = Object.fromEntries(TASK_KINDS.map((k) => [k.value, k.label]));

const STATUS_LABELS = {
  available: 'Available',
  assigned: 'Assigned',
  in_progress: 'In progress',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

export default function ManageVideos() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [referenceFile, setReferenceFile] = useState(null);
  const [meta, setMeta] = useState({
    title: '',
    description: '',
    gameTime: '1 - 00:00',
    durationSeconds: 30,
    taskPrice: 1,
    challengeNote: '',
    kind: 'production',
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkPrice, setBulkPrice] = useState(1);
  const [bulkChallenge, setBulkChallenge] = useState('');
  const [bulkKind, setBulkKind] = useState('production');
  const [savingPrice, setSavingPrice] = useState(null);
  const [savingKind, setSavingKind] = useState(null);
  const [storage, setStorage] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.getAdminAssignments(), api.getStorageStatus()])
      .then(([videosData, storageData]) => {
        setVideos(videosData);
        setStorage(storageData);
      })
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
      let durationSeconds = meta.durationSeconds;
      try {
        const detected = await readVideoDurationFromFile(file);
        if (detected) {
          durationSeconds = Math.round(detected * 100) / 100;
        }
      } catch {
        // keep form value if browser cannot read metadata
      }

      const formData = new FormData();
      formData.append('video', file);
      if (meta.title) formData.append('title', meta.title);
      if (meta.description) formData.append('description', meta.description);
      formData.append('gameTime', meta.gameTime);
      formData.append('durationSeconds', String(durationSeconds));
      formData.append('taskPrice', String(meta.taskPrice));
      formData.append('kind', meta.kind);
      if (meta.challengeNote) formData.append('challengeNote', meta.challengeNote);
      if (referenceFile) formData.append('reference', referenceFile);

      const result = await api.uploadVideo(formData);
      setFile(null);
      setReferenceFile(null);
      setMeta({
        title: '',
        description: '',
        gameTime: '1 - 00:00',
        durationSeconds: 30,
        taskPrice: 1,
        challengeNote: '',
        kind: 'production',
      });
      setMessage(
        result.storage === 'vps'
          ? `Video uploaded to VPS${result.hasReference ? ' with reference JSON' : ''}`
          : `Video added${result.hasReference ? ' with reference JSON' : ''}`
      );
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

  const saveKind = async (videoId, kind) => {
    setSavingKind(videoId);
    setError('');
    try {
      await api.updateAdminTask(videoId, { kind });
      setVideos((prev) =>
        prev.map((v) => (v._id === videoId ? { ...v, kind } : v))
      );
      setMessage(`Marked as ${TASK_KIND_LABELS[kind] || kind}`);
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      setError(err.message);
      load();
    } finally {
      setSavingKind(null);
    }
  };

  const applyBulkKind = async () => {
    if (selectedIds.length === 0) {
      setError('Select at least one video');
      return;
    }
    setSavingKind('bulk');
    setError('');
    try {
      await Promise.all(
        selectedIds.map((id) => api.updateAdminTask(id, { kind: bulkKind }))
      );
      setMessage(`Set ${selectedIds.length} video(s) to ${TASK_KIND_LABELS[bulkKind]}`);
      setSelectedIds([]);
      load();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingKind(null);
    }
  };

  const savePrice = async (videoId, taskPrice, challengeNote) => {
    setSavingPrice(videoId);
    setError('');
    try {
      await api.updateAssignmentPrice(videoId, { taskPrice, challengeNote });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPrice(null);
    }
  };

  const applyBulkPrice = async () => {
    if (selectedIds.length === 0) {
      setError('Select at least one video');
      return;
    }
    setSavingPrice('bulk');
    setError('');
    try {
      await api.bulkUpdateAssignmentPrice({
        assignmentIds: selectedIds,
        taskPrice: bulkPrice,
        challengeNote: bulkChallenge,
      });
      setSelectedIds([]);
      setMessage(`Updated price for ${selectedIds.length} video(s)`);
      load();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPrice(null);
    }
  };

  const uploadReference = async (video, refFile) => {
    if (!refFile) return;
    setSavingPrice(video._id);
    setError('');
    try {
      const formData = new FormData();
      formData.append('reference', refFile);
      await api.uploadAssignmentReference(video._id, formData);
      setMessage('Reference JSON saved');
      load();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPrice(null);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  if (loading) return <div className="loading">Loading videos...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Manage Videos</h1>
        <p>
          Upload, import, or remove football clips. Mark each as <strong>Tutorial</strong>,{' '}
          <strong>Pre-test</strong>, or <strong>Real task</strong>. Tutorial frame explanations
          are configured on <Link to="/admin/tasks">Manage tasks</Link>.
        </p>
        <div className="actions-row" style={{ marginTop: '0.5rem' }}>
          <Link to="/admin" className="btn btn-secondary btn-sm">
            Back to reviews
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {storage && (
        <div className={`alert ${storage.ok ? 'alert-info' : 'alert-error'}`}>
          {storage.enabled ? (
            <>
              <strong>VPS storage connected</strong> — uploads from this page go to{' '}
              {storage.videoDir} on {storage.host}. Videos play from{' '}
              {storage.videoBaseUrl || 'VIDEO_BASE_URL'} ({storage.clipCount ?? 0} clips on VPS).
            </>
          ) : (
            <>
              <strong>Local storage</strong> — clips save to the backend server disk. Set VPS SSH
              env vars on Render to upload directly to your Linux VPS.
            </>
          )}
          {!storage.ok && storage.message && <div style={{ marginTop: 6 }}>{storage.message}</div>}
        </div>
      )}

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
              Clips must be 25 fps. Filename can be the clip ID (30 hex chars). Otherwise a new ID is generated automatically.
            </p>
          </div>
          <div className="form-group">
            <label>Reference JSON (optional)</label>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => setReferenceFile(e.target.files?.[0] || null)}
            />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Optional prior work / gold-standard annotation file ({'{clipId}'}_post.json format).
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
          <div className="form-group">
            <label>Task type</label>
            <select
              value={meta.kind}
              onChange={(e) => setMeta({ ...meta, kind: e.target.value })}
            >
              {TASK_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Tutorial = guided examples · Pre-test = scored practice (3 clips) · Real task =
              paid production work
            </p>
          </div>
          <div className="form-group">
            <label>Task price (USD)</label>
            <input
              type="number"
              min={MIN_PRICE}
              max={MAX_PRICE}
              step="0.1"
              value={meta.taskPrice}
              onChange={(e) => setMeta({ ...meta, taskPrice: parseFloat(e.target.value) || 1 })}
            />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Set between {formatMoney(MIN_PRICE)} and {formatMoney(MAX_PRICE)} based on clip difficulty.
            </p>
          </div>
          <div className="form-group">
            <label>Challenge note (optional)</label>
            <input
              value={meta.challengeNote}
              onChange={(e) => setMeta({ ...meta, challengeNote: e.target.value })}
              placeholder="e.g. Dense events, low visibility"
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
              {importing ? 'Scanning...' : storage?.enabled ? 'Sync VPS clips to app' : 'Import from data folder'}
            </button>
          </div>
        </form>
      </div>

      <h2 style={{ fontSize: '1.15rem', marginBottom: '0.75rem' }}>Videos ({videos.length})</h2>

      {videos.length > 0 && (
        <div className="card bulk-price-bar" style={{ marginBottom: '1rem', padding: '1rem' }}>
          <strong>Bulk actions</strong>
          <div className="actions-row" style={{ marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <select
              value={bulkKind}
              onChange={(e) => setBulkKind(e.target.value)}
              className="kind-select"
            >
              {TASK_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={applyBulkKind}
              disabled={savingKind === 'bulk' || selectedIds.length === 0}
            >
              {savingKind === 'bulk' ? 'Saving...' : `Set type for ${selectedIds.length} selected`}
            </button>
          </div>
          <div className="actions-row" style={{ marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <input
              type="number"
              min={MIN_PRICE}
              max={MAX_PRICE}
              step="0.1"
              value={bulkPrice}
              onChange={(e) => setBulkPrice(parseFloat(e.target.value) || 1)}
              style={{ width: 90 }}
            />
            <input
              value={bulkChallenge}
              onChange={(e) => setBulkChallenge(e.target.value)}
              placeholder="Challenge note (optional)"
              style={{ flex: 1, minWidth: 180 }}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={applyBulkPrice}
              disabled={savingPrice === 'bulk' || selectedIds.length === 0}
            >
              {savingPrice === 'bulk' ? 'Saving...' : `Apply to ${selectedIds.length} selected`}
            </button>
          </div>
        </div>
      )}

      <div className="card table-wrap">
        {videos.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem' }}>
            No videos yet. Upload a clip or import from the data folder.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Clip ID</th>
                <th>Title</th>
                <th>Price</th>
                <th>Challenge</th>
                <th>Task type</th>
                <th>Status</th>
                <th>Ref</th>
                <th>Assigned to</th>
                <th>Created</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((video) => (
                <tr
                  key={video._id}
                  className="table-row-link"
                  onClick={(e) => openLabelerRow(navigate, video._id, e)}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(video._id)}
                      onChange={() => toggleSelect(video._id)}
                    />
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    <VideoLabelLink assignmentId={video._id}>{video.clipId || '—'}</VideoLabelLink>
                  </td>
                  <td>
                    <VideoLabelLink assignmentId={video._id}>{video.title}</VideoLabelLink>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={MIN_PRICE}
                      max={MAX_PRICE}
                      step="0.1"
                      defaultValue={video.taskPrice ?? 1}
                      className="price-input"
                      onBlur={(e) => {
                        const next = parseFloat(e.target.value);
                        if (next !== video.taskPrice && !Number.isNaN(next)) {
                          savePrice(video._id, next, video.challengeNote || '');
                        }
                      }}
                      disabled={savingPrice === video._id}
                    />
                  </td>
                  <td>
                    <input
                      defaultValue={video.challengeNote || ''}
                      placeholder="—"
                      className="challenge-input"
                      onBlur={(e) => {
                        if (e.target.value !== (video.challengeNote || '')) {
                          savePrice(video._id, video.taskPrice ?? 1, e.target.value);
                        }
                      }}
                      disabled={savingPrice === video._id}
                    />
                  </td>
                  <td>
                    <select
                      value={video.kind || 'production'}
                      onChange={(e) => saveKind(video._id, e.target.value)}
                      disabled={savingKind === video._id}
                      className="kind-select"
                      title="Task type"
                    >
                      {TASK_KINDS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`status-badge status-${video.status}`}>
                      {STATUS_LABELS[video.status] || video.status}
                    </span>
                  </td>
                  <td>{video.hasReference ? 'Yes' : '—'}</td>
                  <td>{video.assignedTo?.name || '—'}</td>
                  <td>{formatTimestamp(video.createdAt)}</td>
                  <td>{formatTimestamp(video.updatedAt)}</td>
                  <td>
                    <div className="actions-row" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
                      <VideoLabelLink assignmentId={video._id} className="btn btn-primary btn-sm">
                        Open labeler
                      </VideoLabelLink>
                      <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                        {video.hasReference ? 'Replace JSON' : 'Add JSON'}
                        <input
                          type="file"
                          accept="application/json,.json"
                          hidden
                          onChange={(e) => {
                            const ref = e.target.files?.[0];
                            if (ref) uploadReference(video, ref);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => removeVideo(video)}
                      >
                        Remove
                      </button>
                    </div>
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
