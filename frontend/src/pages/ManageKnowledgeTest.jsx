import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useTableData } from '../hooks/useTableData';
import TableToolbar from '../components/TableToolbar';
import Pagination from '../components/Pagination';

const DIFFICULTY_LABELS = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

function filterQuestions(items, filters) {
  return items.filter((q) => {
    if (filters.difficulty !== 'all' && q.difficulty !== filters.difficulty) return false;
    if (filters.active === 'active' && !q.active) return false;
    if (filters.active === 'inactive' && q.active) return false;
    return true;
  });
}

export default function ManageKnowledgeTest() {
  const [meta, setMeta] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const table = useTableData(questions, {
    searchKeys: ['scenario', 'correctAnswer', 'explanation', 'options'],
    pageSize: 25,
    filterFn: filterQuestions,
    initialFilters: { difficulty: 'all', active: 'all' },
  });

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .getAdminTestQuestions()
      .then((data) => {
        setQuestions(data.questions || []);
        setMeta(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Knowledge test questions</h1>
        <p>
          Full question bank with correct answers and explanations. Labellers receive{' '}
          {meta?.questionsPerAttempt ?? 10} random questions per attempt and must score{' '}
          {meta?.passThreshold ?? 80}%+ to pass.
        </p>
        <div className="actions-row" style={{ marginTop: '0.5rem' }}>
          <Link to="/admin" className="btn btn-secondary btn-sm">
            Back to admin
          </Link>
          <Link to="/test" className="btn btn-secondary btn-sm">
            Preview labeller test
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {meta?.stats && (
        <div className="knowledge-test-stats card" style={{ marginBottom: '1rem', padding: '1rem' }}>
          <strong>{meta.stats.total}</strong> total · <strong>{meta.stats.active}</strong> active in
          pool · {meta.stats.easy} easy · {meta.stats.medium} medium · {meta.stats.hard} hard
        </div>
      )}

      <div className="card table-wrap">
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          searchPlaceholder="Search scenario, answer, explanation…"
          totalCount={questions.length}
          filteredCount={table.totalCount}
        >
          <select
            className="table-filter-select"
            value={table.filters.difficulty}
            onChange={(e) => table.updateFilter('difficulty', e.target.value)}
          >
            <option value="all">All levels</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <select
            className="table-filter-select"
            value={table.filters.active}
            onChange={(e) => table.updateFilter('active', e.target.value)}
          >
            <option value="all">All status</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </TableToolbar>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', padding: '1rem' }}>Loading questions…</p>
        ) : questions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', padding: '1rem' }}>No knowledge test questions found.</p>
        ) : table.totalCount === 0 ? (
          <p style={{ color: 'var(--text-muted)', padding: '1rem' }}>No questions match your filters.</p>
        ) : (
          <>
            <div className="knowledge-test-list">
              {table.paginated.map((question, index) => {
                const rowNum = (table.page - 1) * table.pageSize + index + 1;
                const expanded = expandedId === question._id;
                return (
                  <article
                    key={question._id}
                    className={`knowledge-test-item${expanded ? ' expanded' : ''}`}
                  >
                    <button
                      type="button"
                      className="knowledge-test-item-header"
                      onClick={() =>
                        setExpandedId((current) => (current === question._id ? null : question._id))
                      }
                    >
                      <span className="knowledge-test-item-num">{rowNum}</span>
                      <div className="knowledge-test-item-main">
                        <p className="knowledge-test-scenario">{question.scenario}</p>
                        <div className="knowledge-test-item-meta">
                          <span className={`status-badge difficulty-${question.difficulty}`}>
                            {DIFFICULTY_LABELS[question.difficulty] || question.difficulty}
                          </span>
                          {!question.active && (
                            <span className="status-badge status-rejected">Inactive</span>
                          )}
                          <span className="knowledge-test-answer-pill">
                            Answer: <strong>{question.correctAnswer}</strong>
                          </span>
                        </div>
                      </div>
                      <span className="knowledge-test-expand">{expanded ? '−' : '+'}</span>
                    </button>

                    {expanded && (
                      <div className="knowledge-test-item-body">
                        <div className="knowledge-test-options">
                          <span className="knowledge-test-options-label">Options</span>
                          <ul>
                            {question.options?.map((option) => (
                              <li
                                key={option}
                                className={
                                  option === question.correctAnswer
                                    ? 'knowledge-test-option-correct'
                                    : ''
                                }
                              >
                                {option}
                                {option === question.correctAnswer && (
                                  <span className="knowledge-test-correct-tag">Correct</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="knowledge-test-explanation">
                          <span className="knowledge-test-options-label">Explanation</span>
                          <p>{question.explanation}</p>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            <Pagination
              page={table.page}
              totalPages={table.totalPages}
              pageSize={table.pageSize}
              onPageChange={table.setPage}
              onPageSizeChange={table.setPageSize}
              totalCount={table.totalCount}
            />
          </>
        )}
      </div>
    </div>
  );
}
