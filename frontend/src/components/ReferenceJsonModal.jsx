export default function ReferenceJsonModal({
  open,
  title = 'Reference JSON',
  subtitle = '',
  loading = false,
  error = '',
  json = null,
  onClose,
}) {
  if (!open) return null;

  const text = json ? JSON.stringify(json, null, 2) : '';

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card reference-json-modal" onClick={(e) => e.stopPropagation()}>
        <div className="reference-json-modal-header">
          <div>
            <h3>{title}</h3>
            {subtitle ? <p className="modal-sub">{subtitle}</p> : null}
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        {loading && <p className="modal-sub">Loading reference JSON…</p>}
        {error && <div className="alert alert-error">{error}</div>}

        {!loading && !error && json && (
          <>
            <div className="reference-json-modal-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopy}>
                Copy JSON
              </button>
            </div>
            <pre className="reference-json-view">{text}</pre>
          </>
        )}

        {!loading && !error && !json && (
          <p className="modal-sub">No reference JSON stored for this image.</p>
        )}
      </div>
    </div>
  );
}
