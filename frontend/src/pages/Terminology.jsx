import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import EventFlowDiagrams from '../components/EventFlowDiagrams';
import { frameOffsetSummary, formatOffset, getFrameOffset } from '../config/frameOffsets';

export default function Terminology() {
  const [terms, setTerms] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [tab, setTab] = useState('definitions');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getTerminology()
      .then(setTerms)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading terminology...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Event Terminology Guide</h1>
        <p>
          Official event definitions for labeling. Study these carefully before the knowledge test
          and while labeling clips. All videos are <strong>25 fps</strong>. Frame offsets:{' '}
          <strong>{frameOffsetSummary}</strong>.
          {' '}
          <Link to="/labeling-guide" style={{ fontSize: '0.88rem', marginRight: '0.75rem' }}>
            Full labeling guide →
          </Link>
          <Link to="/faq" style={{ fontSize: '0.88rem' }}>
            Frequent Q&amp;A →
          </Link>
        </p>
      </div>

      <div className="tab-bar">
        <button
          type="button"
          className={`tab-btn${tab === 'definitions' ? ' active' : ''}`}
          onClick={() => setTab('definitions')}
        >
          Definitions
        </button>
        <button
          type="button"
          className={`tab-btn${tab === 'diagrams' ? ' active' : ''}`}
          onClick={() => setTab('diagrams')}
        >
          Flow diagrams
        </button>
      </div>

      {tab === 'diagrams' ? (
        <EventFlowDiagrams />
      ) : (
        <div className="terminology-list">
          {terms.map((term) => (
            <div key={term._id} className="term-item">
              <div
                className="term-header"
                onClick={() => setExpanded(expanded === term._id ? null : term._id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setExpanded(expanded === term._id ? null : term._id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <h3>{term.title}</h3>
                <span className="term-order">#{term.order}</span>
              </div>

              {expanded === term._id && (
                <div className="term-body">
                  <p>{term.definition}</p>
                  <p className="term-frame-offset">
                    Mark timing:{' '}
                    <span className={`offset-badge inline${getFrameOffset(term.eventType) > 0 ? ' positive' : ''}`}>
                      {formatOffset(getFrameOffset(term.eventType))} frames
                    </span>
                  </p>

                  {term.criteria?.length > 0 && (
                    <>
                      <h4>Labeling criteria</h4>
                      <ul>
                        {term.criteria.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </>
                  )}

                  {term.examples?.length > 0 && (
                    <>
                      <h4>Examples</h4>
                      <ul>
                        {term.examples.map((ex) => (
                          <li key={ex}>{ex}</li>
                        ))}
                      </ul>
                    </>
                  )}

                  {term.commonMistakes?.length > 0 && (
                    <>
                      <h4>Common mistakes</h4>
                      <ul>
                        {term.commonMistakes.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
