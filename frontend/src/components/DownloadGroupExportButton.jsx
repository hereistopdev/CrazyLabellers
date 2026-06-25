import { useState } from 'react';
import { api } from '../api';

export default function DownloadGroupExportButton({
  groupId,
  groupName,
  scope = 'labeller',
  variant = 'post',
  className = 'btn btn-secondary btn-sm',
  label,
  compact = false,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!groupId || groupId === 'ungrouped') return null;

  const defaultLabel =
    variant === 'raw'
      ? compact
        ? 'Raw zip'
        : 'Download _post.json zip'
      : compact
        ? 'JSON zip'
        : 'Download group JSON';

  const handleDownload = async () => {
    setLoading(true);
    setError('');
    try {
      if (scope === 'labeller') {
        await api.exportGroupLabels(groupId, variant);
      } else if (scope === 'review') {
        await api.exportReviewGroupLabels(groupId, variant);
      } else {
        await api.exportAdminGroupLabels(groupId, variant);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="download-group-export-wrap">
      <button
        type="button"
        className={className}
        onClick={handleDownload}
        disabled={loading}
        title={
          groupName
            ? `Download all ${variant === 'raw' ? 'raw' : 'post'} JSON files for ${groupName} in a zip folder`
            : undefined
        }
      >
        {loading ? 'Preparing…' : label || defaultLabel}
      </button>
      {error ? (
        <span className="download-group-export-error" style={{ color: 'var(--danger)', fontSize: '0.82rem' }}>
          {error}
        </span>
      ) : null}
    </span>
  );
}
