import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { formatTimestamp } from '../utils/formatTimestamp';
import { formatMoney } from '../utils/money';
import { useTableData } from '../hooks/useTableData';
import TableToolbar from '../components/TableToolbar';
import Pagination from '../components/Pagination';
import UploadGroupSelect, {
  appendGroupFields,
  validateGroupChoice,
  GROUP_NEW,
} from '../components/UploadGroupSelect';
import { resolveImageUrl } from '../utils/imageUrl';
import { analyzeImageUploadFiles, buildImageUploadFormData } from '../utils/imageUploadFiles';
import { matchesDateRange } from '../utils/tableFilter';
import ReferenceJsonModal from '../components/ReferenceJsonModal';

const MIN_PRICE = 0.3;
const MAX_PRICE = 2;

const STATUS_LABELS = {
  available: 'Available',
  assigned: 'Assigned',
  in_progress: 'In progress',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

export default function ManageImages() {
  const [images, setImages] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [groupChoice, setGroupChoice] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [taskPrice, setTaskPrice] = useState('0.5');
  const [description, setDescription] = useState('Cricket keypoint labeling');
  const [shareReference, setShareReference] = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [sharingRef, setSharingRef] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [referenceModal, setReferenceModal] = useState({
    open: false,
    title: '',
    subtitle: '',
    loading: false,
    error: '',
    json: null,
  });

  const load = () => {
    setLoading(true);
    Promise.all([api.getAdminImages(), api.getTaskGroups()])
      .then(([imageRows, groupRows]) => {
        setImages(imageRows);
        setGroups(groupRows);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const table = useTableData(images, {
    searchKeys: ['title', 'imageId', 'groupId.name', 'description'],
    pageSize: 20,
    filterFn: (items, filters) =>
      items.filter((row) => {
        const groupKey = row.groupId?._id || row.groupId || 'ungrouped';
        if (filters.group !== 'all') {
          if (filters.group === 'ungrouped' && groupKey !== 'ungrouped') return false;
          if (filters.group !== 'ungrouped' && String(groupKey) !== filters.group) return false;
        }
        if (filters.status !== 'all' && row.status !== filters.status) return false;
        if (!matchesDateRange(row.createdAt, filters.dateFrom, filters.dateTo)) return false;
        return true;
      }),
    sortFn: (items, filters) => {
      const dir = filters.sortDir === 'asc' ? 1 : -1;
      return [...items].sort((a, b) => {
        if (filters.sortBy === 'title') return a.title.localeCompare(b.title) * dir;
        return (new Date(a.createdAt) - new Date(b.createdAt)) * dir;
      });
    },
    initialFilters: {
      group: 'all',
      status: 'all',
      dateFrom: '',
      dateTo: '',
      sortBy: 'createdAt',
      sortDir: 'desc',
    },
  });

  const groupOptions = useMemo(
    () => groups.map((g) => ({ _id: g._id, name: g.name })),
    [groups]
  );

  const uploadAnalysis = useMemo(
    () => analyzeImageUploadFiles(selectedFiles),
    [selectedFiles]
  );

  const usesFolderGroups = uploadAnalysis.layout === 'group-folders';
  const folderGroupsToUpload = useMemo(
    () => uploadAnalysis.folderGroups.filter((group) => group.imageCount > 0),
    [uploadAnalysis.folderGroups]
  );

  const filteredGroupCount = useMemo(() => {
    if (table.filters.group === 'all') return 0;
    return images.filter((row) => {
      const groupKey = row.groupId?._id || row.groupId || 'ungrouped';
      if (table.filters.group === 'ungrouped') return groupKey === 'ungrouped';
      return String(groupKey) === table.filters.group;
    }).length;
  }, [images, table.filters.group]);

  const pageIds = table.paginated.map((row) => row._id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  const toggleSelectAllPage = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
  };

  const toggleSelectRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]
    );
  };

  const handleFilesChange = (event) => {
    setSelectedFiles([...(event.target.files || [])]);
    event.target.value = '';
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!selectedFiles.length) {
      setError('Select image files or a folder to upload');
      return;
    }

    if (!uploadAnalysis.imageCount) {
      setError('No image files found. Include .png/.jpg files; add matching .json files to import references.');
      return;
    }

    const price = parseFloat(taskPrice);
    if (!Number.isFinite(price) || price < MIN_PRICE || price > MAX_PRICE) {
      setError(`Task price must be between ${MIN_PRICE} and ${MAX_PRICE}`);
      return;
    }

    if (!usesFolderGroups) {
      const groupError = validateGroupChoice(groupChoice, newGroupName);
      if (groupError) {
        setError(groupError);
        return;
      }
    }

    const uploadFields = {
      description,
      taskPrice: String(price),
      allowLabellerReference: shareReference ? 'true' : 'false',
    };

    setUploading(true);
    try {
      if (usesFolderGroups) {
        let totalCreated = 0;
        let totalSkipped = 0;
        let totalMatched = 0;
        const createdGroups = [];

        for (const group of folderGroupsToUpload) {
          const { formData } = buildImageUploadFormData(group.pairs, uploadFields);
          appendGroupFields(formData, { choice: GROUP_NEW, newName: group.groupName });

          const result = await api.uploadImages(formData);
          totalCreated += result.created || 0;
          totalSkipped += result.skipped || 0;
          totalMatched += result.matchedReferences ?? group.matchedCount ?? 0;
          createdGroups.push(group.groupName);
        }

        setMessage(
          `Uploaded ${totalCreated} image${totalCreated === 1 ? '' : 's'} across ${createdGroups.length} group${createdGroups.length === 1 ? '' : 's'} (${createdGroups.join(', ')})` +
            (totalMatched ? ` with ${totalMatched} reference JSON file(s)` : '') +
            (totalSkipped ? ` — ${totalSkipped} skipped` : '')
        );
      } else {
        const { formData } = buildImageUploadFormData(selectedFiles, uploadFields);
        appendGroupFields(formData, { choice: groupChoice, newName: newGroupName });

        const result = await api.uploadImages(formData);
        const matched = result.matchedReferences ?? uploadAnalysis.matchedCount;
        setMessage(
          `Uploaded ${result.created} image${result.created === 1 ? '' : 's'}` +
            (matched ? ` with ${matched} paired reference JSON file(s)` : '') +
            (result.skipped ? ` (${result.skipped} skipped)` : '')
        );
      }

      setSelectedFiles([]);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleToggleReferenceShare = async (row, enabled) => {
    setSharingRef(`${row._id}:${enabled}`);
    setError('');
    try {
      await api.setImageReferenceShare(row._id, enabled);
      setImages((prev) =>
        prev.map((item) =>
          item._id === row._id ? { ...item, allowLabellerReference: enabled } : item
        )
      );
      setMessage(enabled ? 'Reference shared with labellers' : 'Reference hidden from labellers');
    } catch (err) {
      setError(err.message);
    } finally {
      setSharingRef(null);
    }
  };

  const handleReferenceUpload = async (row, file) => {
    if (!file) return;
    setSharingRef(`${row._id}:upload`);
    setError('');
    try {
      await api.uploadImageReference(row._id, (() => {
        const formData = new FormData();
        formData.append('reference', file);
        return formData;
      })());
      setImages((prev) =>
        prev.map((item) =>
          item._id === row._id ? { ...item, hasReference: true } : item
        )
      );
      setMessage('Reference JSON saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setSharingRef(null);
    }
  };

  const handleViewReference = async (row) => {
    setReferenceModal({
      open: true,
      title: 'Origin reference JSON',
      subtitle: row.title || row.imageId,
      loading: true,
      error: '',
      json: null,
    });
    try {
      const data = await api.getImageAssignmentReference(row._id);
      setReferenceModal((prev) => ({
        ...prev,
        loading: false,
        json: data.hasReference ? data.raw : null,
        error: data.hasReference ? '' : 'No reference JSON stored for this image.',
      }));
    } catch (err) {
      setReferenceModal((prev) => ({
        ...prev,
        loading: false,
        error: err.message,
      }));
    }
  };

  const closeReferenceModal = () => {
    setReferenceModal({
      open: false,
      title: '',
      subtitle: '',
      loading: false,
      error: '',
      json: null,
    });
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete image task "${title}"?`)) return;
    setError('');
    try {
      await api.deleteAdminImage(id);
      setSelectedIds((prev) => prev.filter((rowId) => rowId !== id));
      setMessage('Image deleted');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `Delete ${selectedIds.length} selected image task${selectedIds.length === 1 ? '' : 's'}? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingBulk(true);
    setError('');
    try {
      const result = await api.bulkDeleteAdminImages({ assignmentIds: selectedIds });
      setMessage(result.message || `Deleted ${result.deleted} image(s)`);
      setSelectedIds([]);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingBulk(false);
    }
  };

  const handleDeleteFilteredGroup = async () => {
    const groupFilter = table.filters.group;
    if (groupFilter === 'all' || filteredGroupCount === 0) return;

    const groupLabel =
      groupFilter === 'ungrouped'
        ? 'ungrouped images'
        : groupOptions.find((group) => group._id === groupFilter)?.name || 'this group';

    if (
      !window.confirm(
        `Delete all ${filteredGroupCount} image task${filteredGroupCount === 1 ? '' : 's'} in "${groupLabel}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingBulk(true);
    setError('');
    try {
      const result = await api.bulkDeleteAdminImages({ groupId: groupFilter });
      setMessage(result.message || `Deleted ${result.deleted} image(s)`);
      setSelectedIds([]);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingBulk(false);
    }
  };

  const handleReview = async (id, status, title) => {
    let reviewerNotes = '';
    if (status === 'rejected') {
      reviewerNotes =
        window.prompt(`Rejection notes for "${title}" (shown to labeller):`, '') ?? '';
    }

    setReviewing(`${id}:${status}`);
    setError('');
    try {
      await api.reviewImageAssignment(id, { status, reviewerNotes });
      setMessage(status === 'approved' ? 'Submission approved' : 'Submission rejected — labeller can resubmit');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setReviewing(null);
    }
  };

  if (loading) return <div className="loading">Loading images…</div>;

  return (
    <div>
      <div className="page-header page-header--with-actions">
        <div>
          <h1>Image tasks</h1>
          <p>Upload cricket frames for keypoint labeling (pitch + kp0–kp8). Groups can hold up to 100 images.</p>
        </div>
        <Link to="/admin/tasks" className="btn btn-secondary btn-sm">
          Manage groups
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <form className="card" style={{ marginBottom: '1.25rem' }} onSubmit={handleUpload}>
        <h2>Upload images</h2>
        <p className="text-muted" style={{ marginBottom: '0.85rem', fontSize: '0.88rem' }}>
          Pair each image with a JSON file that shares the same base name (e.g.{' '}
          <code>frame_000107.jpg</code> + <code>frame_000107.json</code>). Choose files for one group,
          or choose a folder layout below.
        </p>
        <ul className="text-muted" style={{ marginBottom: '0.85rem', fontSize: '0.88rem', paddingLeft: '1.2rem' }}>
          <li>
            <strong>Single group folder</strong> — select a folder; its name becomes the task group and
            images + JSON inside become tasks.
          </li>
          <li>
            <strong>Multiple groups</strong> — select a parent folder containing subfolders; each
            subfolder name becomes a group with its own images and JSON files.
          </li>
        </ul>
        <div className="form-grid">
          <label className="form-field">
            <span>Choose files</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,.json"
              multiple
              onChange={handleFilesChange}
            />
          </label>

          <label className="form-field">
            <span>Choose folder</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,.json"
              multiple
              webkitdirectory=""
              directory=""
              onChange={handleFilesChange}
            />
          </label>

          {selectedFiles.length > 0 && (
            <div className="form-field form-field--wide">
              <small className="text-muted">
                {uploadAnalysis.imageCount} image(s), {uploadAnalysis.jsonCount} JSON file(s),{' '}
                {uploadAnalysis.matchedCount} auto-paired
                {uploadAnalysis.unmatchedJsonCount > 0
                  ? ` (${uploadAnalysis.unmatchedJsonCount} JSON without matching image)`
                  : ''}
                {usesFolderGroups
                  ? ` · ${uploadAnalysis.groupCount} group folder${uploadAnalysis.groupCount === 1 ? '' : 's'} detected`
                  : ''}
              </small>
              {usesFolderGroups && folderGroupsToUpload.length > 0 && (
                <ul className="text-muted" style={{ marginTop: '0.45rem', fontSize: '0.82rem' }}>
                  {folderGroupsToUpload.map((group) => (
                    <li key={group.groupName}>
                      <strong>{group.groupName}</strong> — {group.imageCount} image
                      {group.imageCount === 1 ? '' : 's'}, {group.matchedCount} paired JSON
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!usesFolderGroups && (
            <UploadGroupSelect
              groups={groupOptions}
              value={groupChoice}
              onChange={setGroupChoice}
              newName={newGroupName}
              onNewNameChange={setNewGroupName}
              label="Task group"
            />
          )}

          {usesFolderGroups && (
            <div className="form-field form-field--wide">
              <small className="text-muted">
                Task groups will be created automatically from folder names. Price, description, and
                reference sharing apply to every group in this upload.
              </small>
            </div>
          )}

          <label className="form-field">
            <span>Task price (USD)</span>
            <input
              type="number"
              min={MIN_PRICE}
              max={MAX_PRICE}
              step="0.05"
              value={taskPrice}
              onChange={(e) => setTaskPrice(e.target.value)}
            />
          </label>

          <label className="form-field form-field--wide">
            <span>Description</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <label className="form-field form-field--wide">
            <span>
              <input
                type="checkbox"
                checked={shareReference}
                onChange={(e) => setShareReference(e.target.checked)}
                style={{ marginRight: '0.45rem' }}
              />
              Share reference JSON with labellers as starting draft
            </span>
          </label>
        </div>

        <button type="submit" className="btn btn-primary" disabled={uploading || !uploadAnalysis.imageCount}>
          {uploading
            ? 'Uploading…'
            : usesFolderGroups
              ? `Upload ${folderGroupsToUpload.length} group${folderGroupsToUpload.length === 1 ? '' : 's'}`
              : 'Upload'}
        </button>
      </form>

      <div className="card table-wrap">
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          searchPlaceholder="Search image ID, group…"
          totalCount={images.length}
          filteredCount={table.totalCount}
        >
          <select
            className="table-filter-select"
            value={table.filters.group}
            onChange={(e) => table.updateFilter('group', e.target.value)}
          >
            <option value="all">All groups</option>
            <option value="ungrouped">Ungrouped</option>
            {groupOptions.map((g) => (
              <option key={g._id} value={g._id}>
                {g.name}
              </option>
            ))}
          </select>
          <select
            className="table-filter-select"
            value={table.filters.status}
            onChange={(e) => table.updateFilter('status', e.target.value)}
          >
            <option value="all">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </TableToolbar>

        <div className="actions-row" style={{ marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={deletingBulk || selectedIds.length === 0}
            onClick={handleBulkDelete}
          >
            {deletingBulk ? 'Deleting…' : `Delete selected${selectedIds.length ? ` (${selectedIds.length})` : ''}`}
          </button>
          {table.filters.group !== 'all' && filteredGroupCount > 0 && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={deletingBulk}
              onClick={handleDeleteFilteredGroup}
            >
              Delete all in filtered group ({filteredGroupCount})
            </button>
          )}
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

        <Pagination
          page={table.page}
          totalPages={table.totalPages}
          pageSize={table.pageSize}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
          totalCount={table.totalCount}
        />

        {table.paginated.length === 0 ? (
          <div className="empty-state">No image tasks yet.</div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectAllPage}
                      title="Select all on this page"
                    />
                  </th>
                  <th>Preview</th>
                  <th>Image ID</th>
                  <th>Group</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th>Assigned</th>
                  <th>Reference</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {table.paginated.map((row) => (
                  <tr key={row._id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row._id)}
                        onChange={() => toggleSelectRow(row._id)}
                      />
                    </td>
                    <td>
                      <img
                        className="admin-image-thumb"
                        src={resolveImageUrl(row.imageUrl)}
                        alt={row.title}
                      />
                    </td>
                    <td>{row.imageId}</td>
                    <td>{row.groupId?.name || '—'}</td>
                    <td>
                      <span className={`status-badge status-${row.status}`}>
                        {STATUS_LABELS[row.status] || row.status}
                      </span>
                    </td>
                    <td>{formatMoney(row.taskPrice ?? 0)}</td>
                    <td>{row.assignedTo?.name || '—'}</td>
                    <td>
                      <div className="actions-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                        {row.hasReference ? (
                          <>
                            <label style={{ fontSize: '0.82rem' }}>
                              <input
                                type="checkbox"
                                checked={Boolean(row.allowLabellerReference)}
                                disabled={sharingRef === `${row._id}:true` || sharingRef === `${row._id}:false`}
                                onChange={(e) => handleToggleReferenceShare(row, e.target.checked)}
                              />{' '}
                              Share with labellers
                            </label>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleViewReference(row)}
                            >
                              View JSON
                            </button>
                          </>
                        ) : (
                          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                            Upload JSON
                            <input
                              type="file"
                              accept=".json,application/json"
                              hidden
                              onChange={(e) => {
                                handleReferenceUpload(row, e.target.files?.[0]);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </td>
                    <td>{formatTimestamp(row.createdAt)}</td>
                    <td>
                      <div className="actions-row">
                        {row.status === 'submitted' && (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={reviewing === `${row._id}:approved`}
                              onClick={() => handleReview(row._id, 'approved', row.title)}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={reviewing === `${row._id}:rejected`}
                              onClick={() => handleReview(row._id, 'rejected', row.title)}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(row._id, row.title)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ReferenceJsonModal
        open={referenceModal.open}
        title={referenceModal.title}
        subtitle={referenceModal.subtitle}
        loading={referenceModal.loading}
        error={referenceModal.error}
        json={referenceModal.json}
        onClose={closeReferenceModal}
      />
    </div>
  );
}
