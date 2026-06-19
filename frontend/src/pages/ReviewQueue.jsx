import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { isAdmin, isValidator } from '../utils/roles';
import { useAuth } from '../context/AuthContext';
import { formatTimestamp } from '../utils/formatTimestamp';
import VideoLabelLink from '../components/VideoLabelLink';
import { openLabelerRow } from '../utils/labelerAccess';
import { useTableData } from '../hooks/useTableData';
import TableToolbar from '../components/TableToolbar';
import Pagination from '../components/Pagination';
import ExportSubmissionButtons from '../components/ExportSubmissionButtons';
import { matchesDateRange } from '../utils/tableFilter';

const STATUS_LABELS = {
  available: 'Available',
  assigned: 'Assigned',
  in_progress: 'In progress',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

export default function ReviewQueue() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const admin = isAdmin(user);
  const validatorOnly = isValidator(user) && !admin;
  const [tab, setTab] = useState(validatorOnly ? 'submissions' : 'videos');
  const [submissions, setSubmissions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSubmissions = () => {
    setLoading(true);
    api
      .getReviewSubmissions(statusFilter)
      .then(setSubmissions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const loadAssignments = () => {
    setLoading(true);
    api
      .getReviewAssignments()
      .then(setAssignments)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tab === 'submissions') loadSubmissions();
    else loadAssignments();
  }, [tab, statusFilter]);

  const videoTable = useTableData(assignments, {
    searchKeys: ['title', 'clipId', 'status'],
    pageSize: 25,
  });

  const submissionTable = useTableData(submissions, {
    searchKeys: ['assignmentId.title', 'userId.name', 'userId.email', 'status'],
    pageSize: 25,
    filterFn: (items, filters) =>
      items.filter((s) => matchesDateRange(s.submittedAt || s.createdAt, filters.dateFrom, filters.dateTo)),
    initialFilters: { dateFrom: '', dateTo: '' },
  });

  if (loading) return <div className="loading">Loading review queue...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Review</h1>
        <p>
          Preview uploaded videos with reference annotations, or review labeller submissions.
        </p>
        {admin && (
          <Link to="/admin" style={{ fontSize: '0.88rem' }}>
            ← Admin dashboard
          </Link>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="actions-row" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className={`btn btn-sm${tab === 'videos' ? ' btn-primary' : ' btn-secondary'}`}
          onClick={() => setTab('videos')}
        >
          All videos
        </button>
        <button
          type="button"
          className={`btn btn-sm${tab === 'submissions' ? ' btn-primary' : ' btn-secondary'}`}
          onClick={() => setTab('submissions')}
        >
          Submissions
        </button>
        {tab === 'submissions' && (
          <label className="filter-label" style={{ marginLeft: '0.5rem' }}>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="submitted">Awaiting review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
          </label>
        )}
      </div>

      {tab === 'videos' ? (
        <div className="card table-wrap">
          <TableToolbar
            search={videoTable.search}
            onSearchChange={videoTable.setSearch}
            searchPlaceholder="Search videos…"
            totalCount={assignments.length}
            filteredCount={videoTable.totalCount}
          />
          {assignments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem' }}>
              No videos uploaded yet
            </p>
          ) : videoTable.totalCount === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem' }}>
              No videos match your search
            </p>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Video</th>
                    <th>Status</th>
                    <th>Reference</th>
                    <th>Submissions</th>
                    <th>Created</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {videoTable.paginated.map((assignment) => (
                  <tr
                    key={assignment._id}
                    className="table-row-link"
                    onClick={(e) => openLabelerRow(navigate, assignment._id, e)}
                  >
                    <td>
                      <VideoLabelLink assignmentId={assignment._id}>{assignment.title}</VideoLabelLink>
                    </td>
                    <td>
                      <span className={`status-pill status-${assignment.status}`}>
                        {STATUS_LABELS[assignment.status] || assignment.status}
                      </span>
                    </td>
                    <td>{assignment.hasReference ? 'Yes' : '—'}</td>
                    <td>{assignment.submissionCount ?? 0}</td>
                    <td>{formatTimestamp(assignment.createdAt)}</td>
                    <td>{formatTimestamp(assignment.updatedAt)}</td>
                    <td>
                      <VideoLabelLink assignmentId={assignment._id} className="btn btn-primary btn-sm">
                        Open labeler
                      </VideoLabelLink>
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
      ) : (
        <div className="card table-wrap">
          <TableToolbar
            search={submissionTable.search}
            onSearchChange={submissionTable.setSearch}
            searchPlaceholder="Search labeller or video…"
            totalCount={submissions.length}
            filteredCount={submissionTable.totalCount}
          >
            <input
              type="date"
              className="table-filter-input table-filter-input--date"
              value={submissionTable.filters.dateFrom}
              onChange={(e) => submissionTable.updateFilter('dateFrom', e.target.value)}
            />
            <input
              type="date"
              className="table-filter-input table-filter-input--date"
              value={submissionTable.filters.dateTo}
              onChange={(e) => submissionTable.updateFilter('dateTo', e.target.value)}
            />
          </TableToolbar>
          {submissions.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem' }}>
              No submissions in this filter
            </p>
          ) : submissionTable.totalCount === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem' }}>
              No submissions match your search
            </p>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Video</th>
                    <th>Labeller</th>
                    <th>Events</th>
                    <th>Auto score</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {submissionTable.paginated.map((submission) => (
                  <tr
                    key={submission._id}
                    className="table-row-link"
                    onClick={(e) =>
                      openLabelerRow(navigate, submission.assignmentId?._id, e)
                    }
                  >
                    <td>
                      <VideoLabelLink assignmentId={submission.assignmentId?._id}>
                        {submission.assignmentId?.title || '—'}
                      </VideoLabelLink>
                    </td>
                    <td>{submission.userId?.name}</td>
                    <td>{submission.events?.length || 0}</td>
                    <td>
                      {submission.autoScore != null ? (
                        <strong>{submission.autoScore}/100</strong>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span className={`status-pill status-${submission.status}`}>
                        {submission.status}
                      </span>
                    </td>
                    <td>{formatTimestamp(submission.submittedAt || submission.createdAt)}</td>
                    <td>{formatTimestamp(submission.updatedAt)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="table-actions-inline">
                        <Link
                          to={`/review/${submission._id}`}
                          className="btn btn-primary btn-sm"
                        >
                          Review with video
                        </Link>
                        {submission.status === 'approved' && submission.assignmentId?.clipId && (
                          <ExportSubmissionButtons
                            submissionId={submission._id}
                            clipId={submission.assignmentId.clipId}
                            hasReference={submission.hasReference}
                            compact
                            className="table-export-actions"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={submissionTable.page}
                totalPages={submissionTable.totalPages}
                pageSize={submissionTable.pageSize}
                onPageChange={submissionTable.setPage}
                onPageSizeChange={submissionTable.setPageSize}
                totalCount={submissionTable.totalCount}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
