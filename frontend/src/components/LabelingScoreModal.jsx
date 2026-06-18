function scoreLabel(score, frameDiff) {
  if (score <= 0) return '0 (missed/wrong)';
  if (frameDiff == null || frameDiff <= 0) return '100 (exact frame)';
  return `${score} (${frameDiff} frame${frameDiff === 1 ? '' : 's'} off)`;
}

export default function LabelingScoreModal({ grading, assignmentTitle, onClose }) {
  if (!grading || grading.error) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()}>
          <h3>Could not score submission</h3>
          <p className="modal-sub">{grading?.error || 'Unknown error'}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  const passed = grading.passed;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card labeling-score-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{passed ? 'Pre-test passed' : 'Pre-test result'}</h3>
        <p className="modal-sub">{assignmentTitle}</p>

        <div className={`labeling-score-total${passed ? ' passed' : ''}`}>
          <span className="labeling-score-value">{grading.autoScore}</span>
          <span className="labeling-score-max">/ 100</span>
        </div>

        <p className="modal-sub">
          {grading.referenceEventCount} reference events · matched {grading.matchedCount} · missing{' '}
          {grading.missingCount} · extra {grading.extraCount}
          {grading.pointsPerEvent
            ? ` · ~${grading.pointsPerEvent.toFixed(1)} pts per event`
            : ''}
        </p>

        {!passed && (
          <p className="alert alert-info" style={{ marginTop: '0.75rem' }}>
            Need {grading.passThreshold}/100 to unlock real tasks. Claim another test clip and try again.
          </p>
        )}

        {grading.breakdown?.length > 0 && (
          <div className="labeling-score-breakdown">
            {grading.breakdown.map((item) => (
              <div key={`${item.eventType}-${item.referenceIndex}`} className="labeling-score-row">
                <span className="type">{item.eventType}</span>
                <span className="meta">
                  {item.status === 'missing'
                    ? 'missing'
                    : scoreLabel(item.score, item.frameDiff)}
                </span>
                <strong>{item.score}</strong>
              </div>
            ))}
          </div>
        )}

        <div className="actions-row" style={{ marginTop: '1rem' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
          {passed ? (
            <a href="/assignments" className="btn btn-primary btn-sm">
              Real tasks
            </a>
          ) : (
            <a href="/labeling-test" className="btn btn-primary btn-sm">
              Try another clip
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
