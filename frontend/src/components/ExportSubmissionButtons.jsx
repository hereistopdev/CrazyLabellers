import { useState } from 'react';
import { api } from '../api';

export default function ExportSubmissionButtons({
  submissionId,
  clipId,
  compact = false,
  className = '',
}) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  if (!submissionId || !clipId) return null;

  const handleExport = async (variant, event) => {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    setExporting(true);
    setError('');
    try {
      await api.exportReviewSubmission(submissionId, variant);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <span className={`export-submission-actions${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={exporting}
        title={`Download ${clipId}_post.json`}
        onClick={(e) => handleExport('post', e)}
      >
        {compact ? 'Post JSON' : 'Download _post.json'}
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={exporting}
        title={`Download ${clipId}.json`}
        onClick={(e) => handleExport('raw', e)}
      >
        {compact ? 'Raw JSON' : 'Download .json'}
      </button>
      {error && (
        <span className="export-submission-error" style={{ color: 'var(--danger)', fontSize: '0.82rem' }}>
          {error}
        </span>
      )}
    </span>
  );
}
