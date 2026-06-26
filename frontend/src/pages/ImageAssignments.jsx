import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { formatMoney } from '../utils/money';
import { imageGroupPath } from '../utils/imageUrl';

export default function ImageAssignments() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState(null);
  const [downloading, setDownloading] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .getImageGroups()
      .then(setGroups)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleClaimAndOpen = async (group) => {
    const routeId = group.groupId || 'ungrouped';
    setClaiming(routeId);
    setError('');
    try {
      if (group.canClaim) {
        await api.claimImageGroup(routeId);
      }
      navigate(imageGroupPath(routeId));
    } catch (err) {
      setError(err.message);
      setClaiming(null);
    }
  };

  const handleDownloadGroup = async (group) => {
    const routeId = group.groupId || 'ungrouped';
    setDownloading(routeId);
    setError('');
    try {
      await api.exportImageGroup(routeId);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(null);
    }
  };

  if (loading) return <div className="loading">Loading image projects...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Cricket image projects</h1>
        <p>
          Each project is one group of frames. Open a project to work in gallery mode — pick frames
          on the left and mark pitch + kp0–kp8 on the side panel.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {groups.length === 0 ? (
        <div className="empty-state">No image projects available yet.</div>
      ) : (
        <div className="card-grid">
          {groups.map((group) => {
            const routeId = group.groupId || 'ungrouped';
            const claimingThis = claiming === routeId;
            const downloadingThis = downloading === routeId;

            return (
              <div key={routeId} className="card image-project-card">
                <h3 style={{ marginBottom: '0.35rem' }}>{group.name}</h3>
                {group.description && (
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    {group.description}
                  </p>
                )}
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  {group.imageCount} frames
                  {group.myCount > 0 && (
                    <>
                      {' '}
                      · {group.completeCount}/{group.myCount} complete
                    </>
                  )}
                  {group.submittedCount > 0 && <> · {group.submittedCount} submitted</>}
                  {group.rejectedCount > 0 && <> · {group.rejectedCount} rejected</>}
                </p>
                {group.availableCount > 0 && group.canClaim && (
                  <p style={{ fontSize: '0.8rem', color: '#93c5fd', marginBottom: '0.5rem' }}>
                    {group.availableCount} frame{group.availableCount === 1 ? '' : 's'} available to claim
                  </p>
                )}

                <div className="actions-row">
                  {group.canOpen ? (
                    <>
                      <Link to={imageGroupPath(routeId)} className="btn btn-primary btn-sm">
                        {group.myCount > 0 ? 'Open gallery' : 'Preview gallery'}
                      </Link>
                      {group.canClaim && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={claimingThis}
                          onClick={() => handleClaimAndOpen(group)}
                        >
                          {claimingThis ? 'Claiming…' : 'Claim & open'}
                        </button>
                      )}
                      {group.myCount > 0 && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={downloadingThis}
                          onClick={() => handleDownloadGroup(group)}
                        >
                          {downloadingThis ? 'Downloading…' : 'Download JSON'}
                        </button>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      No frames available
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
