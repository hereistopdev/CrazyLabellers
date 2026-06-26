import {
  IMAGE_KEYPOINT_LABELS,
  IMAGE_KEYPOINT_LABEL_IDS,
  countMarkedKeypoints,
} from '../config/imageKeypoints';
import ImageKeypointAutoMarkPanel from './ImageKeypointAutoMarkPanel';

export default function ImageKeypointMarkPanel({
  keypoints,
  activeLabel,
  onSelectLabel,
  onClearLabel,
  readOnly = false,
  draftSaved = false,
  projectSubmitted = false,
  completeCount = 0,
  totalLabelable = 0,
  imageTitle = '',
  frameCount = 0,
  selectedFrame = 1,
  onRangeAutoMark,
}) {
  const markedCount = countMarkedKeypoints(keypoints);
  const requiredCount = IMAGE_KEYPOINT_LABEL_IDS.length;

  return (
    <aside className="image-keypoint-mark-panel card">
      {imageTitle && <h3 className="image-keypoint-mark-title">{imageTitle}</h3>}

      <div className="image-keypoint-progress">
        <strong>
          {markedCount} / {requiredCount}
        </strong>{' '}
        on this frame
        {totalLabelable > 0 && (
          <div className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
            Project: {completeCount}/{totalLabelable} frames complete
          </div>
        )}
        {draftSaved && !projectSubmitted && (
          <div className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
            Draft saved locally
          </div>
        )}
      </div>

      {!projectSubmitted && (
        <ImageKeypointAutoMarkPanel
          frameCount={frameCount}
          selectedFrame={selectedFrame}
          activeLabel={activeLabel}
          readOnly={readOnly}
          onAutoMark={onRangeAutoMark}
        />
      )}

      <div className="image-keypoint-label-list">
        {IMAGE_KEYPOINT_LABELS.map((meta) => {
          const placed = Boolean(keypoints[meta.id]);
          const isActive = activeLabel === meta.id;
          return (
            <div
              key={meta.id}
              className={`image-keypoint-label-row${isActive ? ' active' : ''}${placed ? ' placed' : ''}`}
            >
              <button
                type="button"
                className="image-keypoint-label-btn"
                onClick={() => onSelectLabel(meta.id)}
                disabled={readOnly}
              >
                <span className="image-keypoint-swatch" style={{ backgroundColor: meta.color }} />
                <span>{meta.name}</span>
                {placed && <span className="image-keypoint-check">✓</span>}
              </button>
              {placed && !readOnly && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onClearLabel(meta.id)}
                >
                  Clear
                </button>
              )}
            </div>
          );
        })}
      </div>

      {projectSubmitted ? (
        <p className="text-muted image-keypoint-hotkeys">Project submitted</p>
      ) : (
        <p className="text-muted image-keypoint-hotkeys">A / D prev/next · P pitch · 0–8 keypoints</p>
      )}
    </aside>
  );
}
