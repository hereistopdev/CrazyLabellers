import { useState } from 'react';
import { api } from '../api';

export default function ExportSubmissionButtons({
  submissionId,
  clipId,
  hasReference = false,
  compact = false,
  className = '',
}) {
  const [exporting, setExporting] = useState(null);
  const [error, setError] = useState('');

  if (!submissionId || !clipId) return null;

  const handleExport = async (kind, variant, event) => {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    const key = `${kind}-${variant}`;
    setExporting(key);
    setError('');
    try {
      if (kind === 'reference') {
        await api.exportReviewReference(submissionId, variant);
      } else {
        await api.exportReviewSubmission(submissionId, variant);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(null);
    }
  };

  const isBusy = (kind, variant) => exporting === `${kind}-${variant}`;

  return (
    <span className={`export-submission-actions${className ? ` ${className}` : ''}`}>
      <span className="export-submission-group">
        {!compact && <span className="export-submission-label">Labeller</span>}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={Boolean(exporting)}
          title={`Download labeller ${clipId}_post.json`}
          onClick={(e) => handleExport('labeller', 'post', e)}
        >
          {compact ? 'L: Post' : isBusy('labeller', 'post') ? '…' : 'Labeller _post.json'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={Boolean(exporting)}
          title={`Download labeller ${clipId}.json`}
          onClick={(e) => handleExport('labeller', 'raw', e)}
        >
          {compact ? 'L: Raw' : isBusy('labeller', 'raw') ? '…' : 'Labeller .json'}
        </button>
      </span>
      {hasReference && (
        <span className="export-submission-group">
          {!compact && <span className="export-submission-label">Reference</span>}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={Boolean(exporting)}
            title={`Download reference ${clipId}_post.json`}
            onClick={(e) => handleExport('reference', 'post', e)}
          >
            {compact ? 'Ref: Post' : isBusy('reference', 'post') ? '…' : 'Reference _post.json'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={Boolean(exporting)}
            title={`Download reference ${clipId}.json`}
            onClick={(e) => handleExport('reference', 'raw', e)}
          >
            {compact ? 'Ref: Raw' : isBusy('reference', 'raw') ? '…' : 'Reference .json'}
          </button>
        </span>
      )}
      {error && (
        <span className="export-submission-error" style={{ color: 'var(--danger)', fontSize: '0.82rem' }}>
          {error}
        </span>
      )}
    </span>
  );
}
