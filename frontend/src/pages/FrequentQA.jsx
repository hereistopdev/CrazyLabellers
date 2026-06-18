import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../utils/roles';

export default function FrequentQA() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [entries, setEntries] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [expandedId, setExpandedId] = useState(searchParams.get('id') || null);
  const [showUnpublished, setShowUnpublished] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', answer: '', published: true });
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      api.getFrequentQA({ search, eventType: eventFilter, all: admin && showUnpublished }),
      api.getEvents(),
    ])
      .then(([faqList, types]) => {
        setEntries(faqList);
        setEventTypes(types);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [search, eventFilter, admin, showUnpublished]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) setExpandedId(id);
  }, [searchParams]);

  const filteredCount = entries.length;

  const groupedByEvent = useMemo(() => {
    const map = new Map();
    for (const entry of entries) {
      const types = entry.relatedEventTypes?.length ? entry.relatedEventTypes : ['General'];
      for (const type of types) {
        if (!map.has(type)) map.set(type, []);
        map.get(type).push(entry);
      }
    }
    return map;
  }, [entries]);

  const toggleExpand = (id) => {
    setExpandedId((current) => (current === id ? null : id));
    setSearchParams(id ? { id } : {}, { replace: true });
  };

  const startEdit = (entry) => {
    setEditingId(entry._id);
    setEditForm({
      title: entry.title,
      answer: entry.answer,
      published: entry.published !== false,
    });
  };

  const saveEdit = async (id) => {
    try {
      await api.updateFrequentQA(id, editForm);
      setEditingId(null);
      setMessage('FAQ updated');
      setTimeout(() => setMessage(''), 2000);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteEntry = async (id) => {
    if (!window.confirm('Delete this FAQ entry?')) return;
    try {
      await api.deleteFrequentQA(id);
      if (expandedId === id) setExpandedId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading && entries.length === 0) {
    return <div className="loading">Loading Frequent Q&amp;A…</div>;
  }

  return (
    <div className="faq-page">
      <div className="page-header">
        <h1>Frequent Q&amp;A</h1>
        <p>
          Resolved labeling questions from the help assistant. Browse past cases before asking a
          new question on the labeling page.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="faq-toolbar card">
        <input
          type="search"
          placeholder="Search questions and answers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="faq-search-input"
        />
        <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
          <option value="">All event types</option>
          {eventTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        {admin && (
          <label className="faq-admin-toggle">
            <input
              type="checkbox"
              checked={showUnpublished}
              onChange={(e) => setShowUnpublished(e.target.checked)}
            />
            Show unpublished
          </label>
        )}
        <span className="faq-count">{filteredCount} entries</span>
      </div>

      {entries.length === 0 ? (
        <div className="card faq-empty">
          <p>No Frequent Q&amp;A entries yet.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Ask the labeling assistant on a clip page — resolved cases are saved here automatically.
          </p>
          <Link to="/assignments" className="btn btn-primary btn-sm">
            Go to labeling
          </Link>
        </div>
      ) : (
        <div className="faq-list">
          {entries.map((entry) => {
            const expanded = expandedId === entry._id;
            const isEditing = editingId === entry._id;

            return (
              <article
                key={entry._id}
                className={`faq-item card${expanded ? ' faq-item--expanded' : ''}${entry.published === false ? ' faq-item--unpublished' : ''}`}
              >
                <button type="button" className="faq-item-header" onClick={() => toggleExpand(entry._id)}>
                  <div className="faq-item-header-main">
                    <h3>{entry.title}</h3>
                    <p className="faq-item-question">{entry.question}</p>
                  </div>
                  <div className="faq-item-meta">
                    {entry.relatedEventTypes?.map((type) => (
                      <span key={type} className="faq-event-chip">
                        {type}
                      </span>
                    ))}
                    <span className="faq-item-date">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>

                {expanded && (
                  <div className="faq-item-body">
                    {entry.clarifications?.length > 0 && (
                      <div className="faq-clarifications">
                        <h4>How we clarified</h4>
                        <ol>
                          {entry.clarifications.map((step, index) => (
                            <li key={index}>
                              <strong>{step.question}</strong>
                              {step.selectedOption && (
                                <span className="faq-clarification-answer">
                                  → {step.selectedOption}
                                </span>
                              )}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {isEditing ? (
                      <div className="faq-edit-form">
                        <label>
                          Title
                          <input
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          />
                        </label>
                        <label>
                          Answer
                          <textarea
                            rows={4}
                            value={editForm.answer}
                            onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                          />
                        </label>
                        <label className="faq-edit-published">
                          <input
                            type="checkbox"
                            checked={editForm.published}
                            onChange={(e) =>
                              setEditForm({ ...editForm, published: e.target.checked })
                            }
                          />
                          Published (visible to labellers)
                        </label>
                        <div className="faq-edit-actions">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => saveEdit(entry._id)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="faq-answer">{entry.answer}</div>
                        <div className="faq-item-footer">
                          <span>
                            Asked by {entry.createdByName || entry.createdBy?.name || 'Labeller'}
                            {entry.viewCount > 0 && ` · ${entry.viewCount} views`}
                          </span>
                          {admin && (
                            <div className="faq-admin-actions">
                              {entry.published === false && (
                                <span className="faq-unpublished-badge">Unpublished</span>
                              )}
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => startEdit(entry)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => deleteEntry(entry._id)}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {groupedByEvent.size > 1 && (
        <p className="faq-footer-note" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Entries may appear under multiple event types when several apply.
        </p>
      )}
    </div>
  );
}
