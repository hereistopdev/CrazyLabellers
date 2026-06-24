import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatTimestamp } from '../utils/formatTimestamp';
import { formatMoney } from '../utils/money';
import { useTableData } from '../hooks/useTableData';
import TableToolbar from '../components/TableToolbar';
import Pagination from '../components/Pagination';
import { groupProductionTasks, matchesDateRange } from '../utils/tableFilter';
import OpenVideoByUrl from '../components/OpenVideoByUrl';

const STATUS_LABELS = {
  available: 'Available',
  assigned: 'Assigned',
  in_progress: 'In progress',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

export default function Assignments() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [urlMessage, setUrlMessage] = useState('');
  const [claiming, setClaiming] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .getAssignments('production')
      .then(setAssignments)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const taskTable = useTableData(assignments, {
    searchKeys: ['title', 'description', 'clipId', 'groupId.name', 'challengeNote'],
    pageSize: 12,
    filterFn: (items, filters) =>
      items.filter((task) => {
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
      }),
    sortFn: (items, filters) => {
      const dir = filters.sortDir === 'asc' ? 1 : -1;
      return [...items].sort((a, b) => {
        if (filters.sortBy === 'price') {
          return ((a.taskPrice ?? 0) - (b.taskPrice ?? 0)) * dir;
        }
        if (filters.sortBy === 'title') {
          return a.title.localeCompare(b.title) * dir;
        }
        return (new Date(a.createdAt) - new Date(b.createdAt)) * dir;
      });
    },
    initialFilters: {
      group: 'all',
      status: 'all',
      priceMin: '',
      priceMax: '',
      dateFrom: '',
      dateTo: '',
      sortBy: 'createdAt',
      sortDir: 'desc',
    },
  });

  const groupOptions = useMemo(() => {
    const map = new Map();
    assignments.forEach((a) => {
      const group = a.groupId;
      const key = group?._id || group || 'ungrouped';
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: group?.name || 'Other tasks',
          sortOrder: group?.sortOrder ?? 9999,
        });
      }
    });
    return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [assignments]);

  const grouped = useMemo(
    () => groupProductionTasks(taskTable.paginated),
    [taskTable.paginated]
  );

  const handleClaim = async (id) => {
    setClaiming(id);
    try {
      await api.claimAssignment(id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setClaiming(null);
    }
  };

  if (loading) return <div className="loading">Loading assignments...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Production labeling</h1>
        <p>
          Real 30-second clips for paid labeling. Requires knowledge test (80%+), tutorials,
          and labeling pre-test (3 clips, 80/100+).
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {urlMessage && <div className="alert alert-success">{urlMessage}</div>}

      <div className="card open-video-by-url-card" style={{ marginBottom: '1.25rem' }}>
        <OpenVideoByUrl
          onError={(message) => {
            setUrlMessage('');
            setError(message);
          }}
          onSuccess={(message) => {
            setError('');
            setUrlMessage(message);
          }}
        />
      </div>

      <div className="card table-wrap" style={{ marginBottom: '1.25rem' }}>
        <TableToolbar
          search={taskTable.search}
          onSearchChange={taskTable.setSearch}
          searchPlaceholder="Search tasks, groups, clip ID…"
          totalCount={assignments.length}
          filteredCount={taskTable.totalCount}
        >
          <select
            className="table-filter-select"
            value={taskTable.filters.group}
            onChange={(e) => taskTable.updateFilter('group', e.target.value)}
          >
            <option value="all">All groups</option>
            <option value="ungrouped">Ungrouped</option>
            {groupOptions
              .filter((g) => g.id !== 'ungrouped')
              .map((g) => (
                <option key={g.id} value={g.id}>
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
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
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
            <option value="createdAt">Sort: date</option>
            <option value="price">Sort: price</option>
            <option value="title">Sort: title</option>
          </select>
        </TableToolbar>
        <Pagination
          page={taskTable.page}
          totalPages={taskTable.totalPages}
          pageSize={taskTable.pageSize}
          onPageChange={taskTable.setPage}
          onPageSizeChange={taskTable.setPageSize}
          totalCount={taskTable.totalCount}
        />
      </div>

      {assignments.length === 0 ? (
        <div className="empty-state">No assignments available yet.</div>
      ) : taskTable.totalCount === 0 ? (
        <div className="empty-state">No tasks match your search or filters.</div>
      ) : (
        grouped.map((group) => (
          <section key={group.id} className="task-group-section">
            <div className="task-group-header">
              <h2>{group.name}</h2>
              {group.description && (
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{group.description}</p>
              )}
            </div>
            <div className="card-grid">
              {group.tasks.map((a) => {
                const isMine = a.assignedTo?._id === user?.id || a.assignedTo === user?.id;
                const canRelabel =
                  isMine && a.allowLabellerReference && a.status === 'rejected';
                const canOpen =
                  isMine &&
                  (['assigned', 'in_progress', 'submitted'].includes(a.status) || canRelabel);
                const canClaim = a.status === 'available';

                return (
                  <div key={a._id} className="card">
                    <h3 style={{ marginBottom: '0.35rem' }}>{a.title}</h3>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      {a.description}
                    </p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Duration: {a.durationSeconds}s ·{' '}
                      {a.taskPrice != null && (
                        <span className="task-price-badge">Pays up to {formatMoney(a.taskPrice)}</span>
                      )}{' '}
                      <span
                        className={`status-badge status-${a.status === 'available' ? 'approved' : 'passed_test'}`}
                      >
                        {STATUS_LABELS[a.status] || a.status}
                      </span>
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Posted {formatTimestamp(a.createdAt)} · Updated {formatTimestamp(a.updatedAt)}
                    </p>
                    {a.challengeNote && (
                      <p style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: '0.5rem' }}>
                        Challenge: {a.challengeNote}
                      </p>
                    )}
                    {a.allowLabellerReference && (
                      <p style={{ fontSize: '0.8rem', color: '#93c5fd', marginBottom: '0.5rem' }}>
                        Reference available — label by comparing with gold-standard events
                      </p>
                    )}

                    <div className="actions-row">
                      {canClaim && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleClaim(a._id)}
                          disabled={claiming === a._id}
                        >
                          {claiming === a._id ? 'Claiming...' : 'Claim & label'}
                        </button>
                      )}
                      {canOpen && (
                        <Link to={`/label/${a._id}`} className="btn btn-primary btn-sm">
                          {canRelabel
                            ? 'Re-label with reference'
                            : a.status === 'submitted' && isMine
                              ? 'Edit & re-submit'
                              : 'Open labeler'}
                        </Link>
                      )}
                      {a.status === 'submitted' && isMine && (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          Awaiting review — edits allowed until validated
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
