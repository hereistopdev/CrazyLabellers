import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../utils/roles';
import { api } from '../api';
import { formatMoney, isFreeTaskKind } from '../utils/money';
import { readVideoDurationFromFile } from '../utils/videoDuration';
import { formatTimestamp } from '../utils/formatTimestamp';
import VideoLabelLink from '../components/VideoLabelLink';
import { parseBulkUploadFiles, summarizeBulkUpload } from '../utils/parseBulkUploadFiles';
import { isVideoFilename } from '../utils/clipId';
import { openLabelerRow } from '../utils/labelerAccess';
import { useTableData } from '../hooks/useTableData';
import TableToolbar from '../components/TableToolbar';
import Pagination from '../components/Pagination';
import UploadGroupSelect, { appendGroupFields, GROUP_NEW } from '../components/UploadGroupSelect';

const UPLOAD_CONCURRENCY = 2;

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

function userLabel(user) {
  return user?.name || user?.email || '—';
}

function validateGroupChoice(choice, newName) {
  if (choice === GROUP_NEW && !newName?.trim()) {
    return 'Enter a name for the new production group';
  }
  return null;
}

export default function ManageVideos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const adminUser = isAdmin(user);
  const [videos, setVideos] = useState([]);
  const [tableLoading, setTableLoading] = useState(true);
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
  const [uploadClips, setUploadClips] = useState([]);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [uploadBulkKind, setUploadBulkKind] = useState('production');
  const [uploadBulkTaskPrice, setUploadBulkTaskPrice] = useState(1);
  const [uploadSkipExisting, setUploadSkipExisting] = useState(true);
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [bulkUploadResult, setBulkUploadResult] = useState(null);
  const [taskGroups, setTaskGroups] = useState([]);
  const [uploadGroupChoice, setUploadGroupChoice] = useState('');
  const [uploadNewGroupName, setUploadNewGroupName] = useState('');
  const [bulkGroupChoice, setBulkGroupChoice] = useState('');
  const [bulkNewGroupName, setBulkNewGroupName] = useState('');

  const loadGroups = () => {
    api.getTaskGroups().then(setTaskGroups).catch(() => setTaskGroups([]));
  };

  const load = () => {
    setTableLoading(true);
    Promise.all([api.getAdminAssignments(), api.getStorageStatus()])
      .then(([videosData, storageData]) => {
        setVideos(videosData);
        setStorage(storageData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setTableLoading(false));
  };

  const videoTable = useTableData(videos, {
    searchKeys: ['title', 'clipId', 'assignedTo.name', 'status', 'challengeNote'],
    pageSize: 25,
    filterFn: (items, filters) =>
      items.filter((video) => {
        const kind = video.kind || 'production';
        if (filters.kind !== 'all' && kind !== filters.kind) return false;
        if (filters.status !== 'all' && video.status !== filters.status) return false;
        return true;
      }),
    initialFilters: { kind: 'all', status: 'all' },
  });

  useEffect(load, []);

  useEffect(loadGroups, []);

  useEffect(() => {
    if (window.location.hash === '#bulk-upload') {
      document.getElementById('bulk-upload')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const uploadVideo = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Choose a video file to upload');
      return;
    }

    setUploading(true);
    setError('');
    const groupError = validateGroupChoice(uploadGroupChoice, uploadNewGroupName);
    if (groupError) {
      setError(groupError);
      setUploading(false);
      return;
    }
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
      formData.append('taskPrice', String(isFreeTaskKind(meta.kind) ? 0 : meta.taskPrice));
      formData.append('kind', meta.kind);
      if (meta.challengeNote) formData.append('challengeNote', meta.challengeNote);
      if (referenceFile) formData.append('reference', referenceFile);
      appendGroupFields(formData, {
        choice: uploadGroupChoice,
        newName: uploadNewGroupName,
        kind: meta.kind,
      });

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
      loadGroups();
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

  const handleBulkFolderSelect = (event) => {
    const files = event.target.files;
    if (!files?.length) {
      return;
    }

    const { clips, rejected } = parseBulkUploadFiles(files);
    const existingClipIds = new Set(videos.map((v) => v.clipId).filter(Boolean));
    const summary = summarizeBulkUpload(clips, existingClipIds, rejected);
    setUploadClips(clips);
    setUploadSummary(summary);
    setUploadProgress(null);
    setBulkUploadResult(null);

    if (clips.length === 0) {
      const videoCount = rejected.filter((item) => isVideoFilename(item.name)).length;
      setError(
        videoCount > 0
          ? `Found ${videoCount} video file(s) but none could be prepared for upload. Check filenames are safe (letters, numbers, _ and -).`
          : 'No video files found. Choose a folder with videos in data/ (and optional JSON in annotations/).'
      );
    } else {
      setError('');
      setMessage(
        rejected.length > 0
          ? `Selected ${clips.length} video(s). JSON is optional — matched ${summary.withPostRef} reference file(s). Ignored ${rejected.length} unrelated file(s).`
          : `Selected ${clips.length} video(s)${summary.withoutJson ? ` (${summary.withoutJson} without JSON)` : ''}.`
      );
      setTimeout(() => setMessage(''), 6000);
    }

    event.target.value = '';
  };

  const runBulkUpload = async () => {
    if (uploadClips.length === 0) {
      setError('Choose a folder with video files first');
      return;
    }

    setUploadingBulk(true);
    setError('');
    setMessage('');
    setBulkUploadResult(null);

    const groupError = validateGroupChoice(bulkGroupChoice, bulkNewGroupName);
    if (groupError) {
      setError(groupError);
      setUploadingBulk(false);
      return;
    }

    const totals = { created: 0, skipped: 0, updated: 0, errors: 0 };
    const errorDetails = [];
    let completed = 0;
    let index = 0;

    const uploadOne = async (clip) => {
      const formData = new FormData();
      formData.append('video', clip.video, clip.video.name);
      formData.append('clipId', clip.clipId);
      if (clip.postRef) {
        formData.append('referencePost', clip.postRef, clip.postRef.name);
      }
      if (clip.rawRef) {
        formData.append('referenceRaw', clip.rawRef, clip.rawRef.name);
      }
      formData.append('kind', uploadBulkKind);
      formData.append('taskPrice', String(isFreeTaskKind(uploadBulkKind) ? 0 : uploadBulkTaskPrice));
      formData.append('skipExisting', String(uploadSkipExisting));
      appendGroupFields(formData, {
        choice: bulkGroupChoice,
        newName: bulkNewGroupName,
        kind: uploadBulkKind,
      });

      const result = await api.uploadBulkClip(formData);
      if (result.skipped) totals.skipped += 1;
      else if (result.updated) totals.updated += 1;
      else totals.created += 1;
    };

    const worker = async () => {
      while (index < uploadClips.length) {
        const current = index;
        index += 1;
        const clip = uploadClips[current];
        try {
          await uploadOne(clip);
        } catch (err) {
          totals.errors += 1;
          errorDetails.push({ clipId: clip.clipId, message: err.message });
        }
        completed += 1;
        setUploadProgress({
          completed,
          total: uploadClips.length,
          ...totals,
          currentClipId: clip.clipId,
          errorDetails: [...errorDetails],
        });
      }
    };

    try {
      await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, () => worker()));

      const summary = `${totals.created} created, ${totals.updated} updated, ${totals.skipped} skipped, ${totals.errors} failed`;
      const resultPayload = {
        ...totals,
        summary,
        errorDetails,
        phase:
          totals.errors === 0
            ? 'success'
            : totals.errors === uploadClips.length
              ? 'failed'
              : 'partial',
      };
      setBulkUploadResult(resultPayload);

      if (totals.errors === 0) {
        setMessage(`Bulk upload succeeded — ${summary}`);
      } else if (totals.created + totals.updated + totals.skipped > 0) {
        setError(`Bulk upload finished with errors — ${summary}`);
      } else {
        setError(`Bulk upload failed — ${summary}`);
      }

      loadGroups();
      load();
      setTimeout(() => setMessage(''), 10000);
    } catch (err) {
      setBulkUploadResult({ phase: 'failed', summary: err.message, errorDetails });
      setError(err.message);
    } finally {
      setUploadingBulk(false);
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

  return (
    <div>
      <div className="page-header">
        <h1>Manage Videos</h1>
        <p>
          Upload, import, or remove football clips. Use <strong>Bulk upload</strong> to import a
          whole folder of videos and reference JSON at once.
        </p>
        <div className="actions-row" style={{ marginTop: '0.5rem' }}>
          {adminUser ? (
            <Link to="/admin" className="btn btn-secondary btn-sm">
              Back to admin
            </Link>
          ) : (
            <Link to="/" className="btn btn-secondary btn-sm">
              Back to dashboard
            </Link>
          )}
          <a href="#bulk-upload" className="btn btn-primary btn-sm">
            Jump to bulk upload
          </a>
          <Link to="/admin/tasks" className="btn btn-secondary btn-sm">
            Tasks & groups
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

      <div
        id="bulk-upload"
        className="card bulk-import-panel bulk-upload-highlight"
        style={{ marginBottom: '2rem', padding: '1.25rem' }}
      >
        <h3 style={{ marginBottom: '0.5rem' }}>Bulk upload (folder)</h3>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Select a folder with videos in <strong>data/</strong> and optional JSON in{' '}
          <strong>annotations/</strong>. No strict naming rules — videos and JSON are paired when
          filenames are <strong>80%+ similar</strong>. JSON is optional. Supported video formats:
          mp4, webm, mov, mkv, avi, m4v.
        </p>

        <div className="form-group">
          <label>Choose folder</label>
          <input
            type="file"
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleBulkFolderSelect}
            disabled={uploadingBulk}
          />
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Example: <code>D:\Bittensor\3754293_2</code> with <code>data/3754293_2_p000.mp4</code> and
            optional <code>annotations/3754293_2_p000_post.json</code>.
          </p>
        </div>

        {adminUser && (
          <div className="form-grid" style={{ marginBottom: '1rem' }}>
            <label>
              Task type for new clips
              <select
                value={uploadBulkKind}
                onChange={(e) => setUploadBulkKind(e.target.value)}
                disabled={uploadingBulk}
              >
                {TASK_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            {!isFreeTaskKind(uploadBulkKind) && (
              <label>
                Task price ($)
                <input
                  type="number"
                  min={MIN_PRICE}
                  max={MAX_PRICE}
                  step="0.1"
                  value={uploadBulkTaskPrice}
                  onChange={(e) => setUploadBulkTaskPrice(parseFloat(e.target.value) || 1)}
                  disabled={uploadingBulk}
                />
              </label>
            )}
          </div>
        )}

        {(!adminUser || uploadBulkKind === 'production') && (
          <UploadGroupSelect
            groups={taskGroups}
            value={bulkGroupChoice}
            newName={bulkNewGroupName}
            onChange={setBulkGroupChoice}
            onNewNameChange={setBulkNewGroupName}
            disabled={uploadingBulk}
            kind={uploadBulkKind}
          />
        )}

        <label className="review-playback-toggle" style={{ display: 'block', marginBottom: '1rem' }}>
          <input
            type="checkbox"
            checked={uploadSkipExisting}
            onChange={(e) => setUploadSkipExisting(e.target.checked)}
            disabled={uploadingBulk}
          />
          Skip clips already in the app (still updates reference JSON if provided)
        </label>

        {uploadSummary && (
          <div
            className={`alert ${uploadSummary.total === 0 ? 'alert-error' : 'alert-info'}`}
            style={{ marginBottom: '1rem' }}
          >
            {uploadSummary.total === 0 ? (
              <>
                <strong>No videos ready to upload.</strong>{' '}
                {uploadSummary.rejectedVideoCount > 0
                  ? `Found ${uploadSummary.rejectedVideoCount} video file(s) that could not be used.`
                  : 'No supported video files were found in data/.'}
              </>
            ) : (
              <>
                Ready to upload <strong>{uploadSummary.total}</strong> video(s) ·{' '}
                {uploadSummary.withPostRef} with matched JSON · {uploadSummary.withRawRef} with extra
                raw JSON · {uploadSummary.withoutJson} without JSON · {uploadSummary.alreadyInApp}{' '}
                already in app
                {uploadSummary.rejectedCount > 0 && (
                  <> · {uploadSummary.rejectedCount} file(s) ignored</>
                )}
              </>
            )}
            {uploadSummary.rejectedSamples?.length > 0 && (
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem', fontSize: '0.82rem' }}>
                {uploadSummary.rejectedSamples.map((item) => (
                  <li key={`${item.name}-${item.reason}`}>
                    <code>{item.name}</code> — {item.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {uploadingBulk && (
          <div className="alert alert-info bulk-upload-status" style={{ marginBottom: '1rem' }}>
            <strong>Upload in progress…</strong>{' '}
            {uploadProgress
              ? `${uploadProgress.completed}/${uploadProgress.total} clips processed`
              : `Starting upload of ${uploadClips.length} clips…`}
            {uploadProgress && (
              <>
                {' '}
                — created {uploadProgress.created}, updated {uploadProgress.updated}, skipped{' '}
                {uploadProgress.skipped}, failed {uploadProgress.errors}
                {uploadProgress.currentClipId && (
                  <>
                    {' '}
                    · current: <code>{uploadProgress.currentClipId}</code>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {!uploadingBulk && bulkUploadResult && (
          <div
            className={`alert ${
              bulkUploadResult.phase === 'success'
                ? 'alert-success'
                : bulkUploadResult.phase === 'partial'
                  ? 'alert-info'
                  : 'alert-error'
            }`}
            style={{ marginBottom: '1rem' }}
          >
            <strong>
              {bulkUploadResult.phase === 'success'
                ? 'Bulk upload succeeded'
                : bulkUploadResult.phase === 'partial'
                  ? 'Bulk upload finished with errors'
                  : 'Bulk upload failed'}
            </strong>
            {' — '}
            {bulkUploadResult.summary}
            {bulkUploadResult.errorDetails?.length > 0 && (
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem', fontSize: '0.82rem' }}>
                {bulkUploadResult.errorDetails.slice(0, 8).map((item) => (
                  <li key={item.clipId}>
                    <code>{item.clipId}</code>: {item.message}
                  </li>
                ))}
                {bulkUploadResult.errorDetails.length > 8 && (
                  <li>…and {bulkUploadResult.errorDetails.length - 8} more</li>
                )}
              </ul>
            )}
          </div>
        )}

        {uploadProgress && uploadingBulk && (
          <div className="bulk-upload-progress-bar" style={{ marginBottom: '1rem' }}>
            <div
              style={{
                height: 8,
                borderRadius: 4,
                background: 'var(--border)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.round((uploadProgress.completed / uploadProgress.total) * 100)}%`,
                  height: '100%',
                  background: 'var(--primary)',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          </div>
        )}

        <div className="actions-row">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={runBulkUpload}
            disabled={uploadingBulk || uploadClips.length === 0}
          >
            {uploadingBulk
              ? `Uploading ${uploadProgress?.completed ?? 0}/${uploadClips.length}...`
              : `Upload ${uploadClips.length || 0} clips`}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Add video</h3>
        <form onSubmit={uploadVideo}>
          <div className="form-group">
            <label>Video file</label>
            <input
              type="file"
              accept="video/*,.mp4,.webm,.mov,.mkv,.avi,.m4v"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              mp4, webm, mov, mkv, avi, or m4v. Reference JSON is optional.
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
          {(!adminUser || meta.kind === 'production') && (
            <UploadGroupSelect
              groups={taskGroups}
              value={uploadGroupChoice}
              newName={uploadNewGroupName}
              onChange={setUploadGroupChoice}
              onNewNameChange={setUploadNewGroupName}
              disabled={uploading}
              kind={meta.kind}
            />
          )}
          {adminUser && (
            <>
              <div className="form-group">
                <label>Task type</label>
                <select
                  value={meta.kind}
                  onChange={(e) => {
                    const kind = e.target.value;
                    setMeta({
                      ...meta,
                      kind,
                      taskPrice: isFreeTaskKind(kind) ? 0 : meta.taskPrice || 1,
                    });
                  }}
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
                {isFreeTaskKind(meta.kind) ? (
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
                    {formatMoney(0)} — tutorials and pre-tests are free for labellers.
                  </p>
                ) : (
                  <>
                    <input
                      type="number"
                      min={MIN_PRICE}
                      max={MAX_PRICE}
                      step="0.1"
                      value={meta.taskPrice}
                      onChange={(e) => setMeta({ ...meta, taskPrice: parseFloat(e.target.value) || 1 })}
                    />
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      Set between {formatMoney(MIN_PRICE)} and {formatMoney(MAX_PRICE)} based on clip
                      difficulty.
                    </p>
                  </>
                )}
              </div>
              <div className="form-group">
                <label>Challenge note (optional)</label>
                <input
                  value={meta.challengeNote}
                  onChange={(e) => setMeta({ ...meta, challengeNote: e.target.value })}
                  placeholder="e.g. Dense events, low visibility"
                />
              </div>
            </>
          )}
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

      <h2 style={{ fontSize: '1.15rem', marginBottom: '0.75rem' }}>
        Videos ({videoTable.totalCount} shown / {videos.length} total)
      </h2>

      {adminUser && videos.length > 0 && (
        <div className="card bulk-actions-bar">
          <strong className="bulk-actions-title">Bulk actions</strong>
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
                disabled={savingKind === 'bulk' || selectedIds.length === 0}
              >
                {savingKind === 'bulk' ? 'Saving...' : `Set type for ${selectedIds.length} selected`}
              </button>
            </div>
          </div>
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
                disabled={savingPrice === 'bulk' || selectedIds.length === 0}
              >
                {savingPrice === 'bulk' ? 'Saving...' : `Apply to ${selectedIds.length} selected`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card table-wrap">
        <TableToolbar
          search={videoTable.search}
          onSearchChange={videoTable.setSearch}
          searchPlaceholder="Search title, clip ID, assignee, status…"
          totalCount={videos.length}
          filteredCount={videoTable.totalCount}
        >
          <select
            className="table-filter-select"
            value={videoTable.filters.kind}
            onChange={(e) => videoTable.updateFilter('kind', e.target.value)}
          >
            <option value="all">All types</option>
            {TASK_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <select
            className="table-filter-select"
            value={videoTable.filters.status}
            onChange={(e) => videoTable.updateFilter('status', e.target.value)}
          >
            <option value="all">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </TableToolbar>

        {tableLoading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem' }}>
            Loading video list…
          </p>
        ) : videos.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem' }}>
            No videos yet. Use bulk upload above or upload a single clip.
          </p>
        ) : videoTable.totalCount === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem' }}>
            No videos match your search or filters.
          </p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  {adminUser && <th></th>}
                  <th>Clip ID</th>
                  <th>Title</th>
                  {adminUser && <th>Price</th>}
                  {adminUser && <th>Challenge</th>}
                  {adminUser && <th>Task type</th>}
                  <th>Status</th>
                  <th>Group</th>
                  <th>Ref</th>
                  <th>Uploaded by</th>
                  <th>Validated by</th>
                  <th>Assigned to</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {videoTable.paginated.map((video) => (
                <tr
                  key={video._id}
                  className="table-row-link"
                  onClick={(e) => openLabelerRow(navigate, video._id, e)}
                >
                  {adminUser && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(video._id)}
                        onChange={() => toggleSelect(video._id)}
                      />
                    </td>
                  )}
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    <VideoLabelLink assignmentId={video._id}>{video.clipId || '—'}</VideoLabelLink>
                  </td>
                  <td>
                    <VideoLabelLink assignmentId={video._id}>{video.title}</VideoLabelLink>
                  </td>
                  {adminUser && (
                    <td>
                      {isFreeTaskKind(video.kind) ? (
                        <span style={{ color: 'var(--text-muted)' }}>{formatMoney(0)}</span>
                      ) : (
                        <input
                          type="number"
                          min={MIN_PRICE}
                          max={MAX_PRICE}
                          step="0.1"
                          defaultValue={video.taskPrice ?? 1}
                          className="price-input field-input--sm"
                          onBlur={(e) => {
                            const next = parseFloat(e.target.value);
                            if (next !== video.taskPrice && !Number.isNaN(next)) {
                              savePrice(video._id, next, video.challengeNote || '');
                            }
                          }}
                          disabled={savingPrice === video._id}
                        />
                      )}
                    </td>
                  )}
                  {adminUser && (
                    <td>
                      <input
                        defaultValue={video.challengeNote || ''}
                        placeholder="—"
                        className="challenge-input field-input--sm"
                        onBlur={(e) => {
                          if (e.target.value !== (video.challengeNote || '')) {
                            savePrice(video._id, video.taskPrice ?? 1, e.target.value);
                          }
                        }}
                        disabled={savingPrice === video._id}
                      />
                    </td>
                  )}
                  {adminUser && (
                    <td>
                      <select
                        value={video.kind || 'production'}
                        onChange={(e) => saveKind(video._id, e.target.value)}
                        disabled={savingKind === video._id}
                        className="kind-select field-input--sm"
                        title="Task type"
                      >
                        {TASK_KINDS.map((k) => (
                          <option key={k.value} value={k.value}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td>
                    <span className={`status-badge status-${video.status}`}>
                      {STATUS_LABELS[video.status] || video.status}
                    </span>
                  </td>
                  <td>{video.groupId?.name || '—'}</td>
                  <td>{video.hasReference ? 'Yes' : '—'}</td>
                  <td>{userLabel(video.uploadedBy)}</td>
                  <td>{userLabel(video.reviewedBy)}</td>
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
            <Pagination
              page={videoTable.page}
              totalPages={videoTable.totalPages}
              pageSize={videoTable.pageSize}
              onPageChange={videoTable.setPage}
              onPageSizeChange={videoTable.setPageSize}
              totalCount={videoTable.totalCount}
            />
          </>
        )}
      </div>
    </div>
  );
}
