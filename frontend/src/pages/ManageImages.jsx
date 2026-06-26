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
} from '../components/UploadGroupSelect';
import { resolveImageUrl } from '../utils/imageUrl';
import { matchesDateRange } from '../utils/tableFilter';

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

  const handleUpload = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const groupError = validateGroupChoice(groupChoice, newGroupName);
    if (groupError) {
      setError(groupError);
      return;
    }

    if (!selectedFiles.length) {
      setError('Select one or more image files');
      return;
    }

    const price = parseFloat(taskPrice);
    if (!Number.isFinite(price) || price < MIN_PRICE || price > MAX_PRICE) {
      setError(`Task price must be between ${MIN_PRICE} and ${MAX_PRICE}`);
      return;
    }

    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append('images', file));
    formData.append('description', description);
    formData.append('taskPrice', String(price));
    appendGroupFields(formData, groupChoice, newGroupName);

    setUploading(true);
    try {
      const result = await api.uploadImages(formData);
      setMessage(
        `Uploaded ${result.created} image${result.created === 1 ? '' : 's'}` +
          (result.skipped ? ` (${result.skipped} skipped)` : '')
      );
      setSelectedFiles([]);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete image task "${title}"?`)) return;
    setError('');
    try {
      await api.deleteAdminImage(id);
      setMessage('Image deleted');
      load();
    } catch (err) {
      setError(err.message);
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
        <div className="form-grid">
          <label className="form-field">
            <span>Image files</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              onChange={(e) => setSelectedFiles([...(e.target.files || [])])}
            />
            {selectedFiles.length > 0 && (
              <small className="text-muted">{selectedFiles.length} file(s) selected</small>
            )}
          </label>

          <UploadGroupSelect
            groups={groupOptions}
            groupChoice={groupChoice}
            onGroupChoiceChange={setGroupChoice}
            newGroupName={newGroupName}
            onNewGroupNameChange={setNewGroupName}
          />

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
        </div>

        <button type="submit" className="btn btn-primary" disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload'}
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
                  <th>Preview</th>
                  <th>Image ID</th>
                  <th>Group</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th>Assigned</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {table.paginated.map((row) => (
                  <tr key={row._id}>
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
                    <td>{formatTimestamp(row.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(row._id, row.title)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
