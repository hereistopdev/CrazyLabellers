import { useEffect, useMemo, useState } from 'react';
import { IMAGE_KEYPOINT_LABELS } from '../config/imageKeypoints';
import { MIN_AUTO_MARK_REFERENCES } from '../utils/imageKeypointAutoMark';

function clampFrame(value, min, max) {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export default function ImageKeypointAutoMarkPanel({
  frameCount = 0,
  selectedFrame = 1,
  activeLabel = 'pitch',
  readOnly = false,
  onAutoMark,
}) {
  const [referenceFrom, setReferenceFrom] = useState(1);
  const [referenceTo, setReferenceTo] = useState(2);
  const [targetFrom, setTargetFrom] = useState(3);
  const [targetTo, setTargetTo] = useState(3);
  const [markLabel, setMarkLabel] = useState(activeLabel);

  useEffect(() => {
    setMarkLabel(activeLabel);
  }, [activeLabel]);

  useEffect(() => {
    if (frameCount <= 0) return;
    const refTo = Math.min(frameCount, Math.max(MIN_AUTO_MARK_REFERENCES, 2));
    const refFrom = Math.max(1, refTo - (MIN_AUTO_MARK_REFERENCES - 1));
    const tgtFrom = Math.min(frameCount, refTo + 1);
    setReferenceFrom(refFrom);
    setReferenceTo(refTo);
    setTargetFrom(tgtFrom);
    setTargetTo(frameCount);
  }, [frameCount]);

  const labelOptions = useMemo(
    () => [
      { id: 'all', name: 'All marked on references' },
      ...IMAGE_KEYPOINT_LABELS.map((meta) => ({ id: meta.id, name: meta.name })),
    ],
    []
  );

  const handleUseCurrentFrame = () => {
    if (frameCount <= 0) return;
    const refTo = clampFrame(selectedFrame, 1, frameCount);
    const refFrom = clampFrame(refTo - (MIN_AUTO_MARK_REFERENCES - 1), 1, frameCount);
    const tgtFrom = clampFrame(refTo + 1, 1, frameCount);
    setReferenceFrom(Math.min(refFrom, refTo));
    setReferenceTo(refTo);
    setTargetFrom(tgtFrom);
    setTargetTo(frameCount);
  };

  const handleSubmit = () => {
    onAutoMark?.({
      referenceFrom,
      referenceTo,
      targetFrom,
      targetTo,
      label: markLabel,
    });
  };

  if (readOnly || frameCount === 0) return null;

  return (
    <div className="image-auto-mark-panel">
      <h4 className="image-auto-mark-title">Auto-mark</h4>

      <div className="image-auto-mark-range">
        <span className="image-auto-mark-range-label">Reference frames</span>
        <div className="image-auto-mark-range-inputs">
          <label>
            <span className="sr-only">Reference from</span>
            <input
              type="number"
              min={1}
              max={frameCount}
              value={referenceFrom}
              onChange={(e) => setReferenceFrom(clampFrame(e.target.value, 1, frameCount))}
            />
          </label>
          <span className="image-auto-mark-range-sep">to</span>
          <label>
            <span className="sr-only">Reference to</span>
            <input
              type="number"
              min={1}
              max={frameCount}
              value={referenceTo}
              onChange={(e) => setReferenceTo(clampFrame(e.target.value, 1, frameCount))}
            />
          </label>
        </div>
      </div>

      <div className="image-auto-mark-range">
        <span className="image-auto-mark-range-label">Target frames</span>
        <div className="image-auto-mark-range-inputs">
          <label>
            <span className="sr-only">Target from</span>
            <input
              type="number"
              min={1}
              max={frameCount}
              value={targetFrom}
              onChange={(e) => setTargetFrom(clampFrame(e.target.value, 1, frameCount))}
            />
          </label>
          <span className="image-auto-mark-range-sep">to</span>
          <label>
            <span className="sr-only">Target to</span>
            <input
              type="number"
              min={1}
              max={frameCount}
              value={targetTo}
              onChange={(e) => setTargetTo(clampFrame(e.target.value, 1, frameCount))}
            />
          </label>
        </div>
      </div>

      <div className="image-auto-mark-field">
        <label htmlFor="image-auto-mark-label">Point</label>
        <select
          id="image-auto-mark-label"
          value={markLabel}
          onChange={(e) => setMarkLabel(e.target.value)}
        >
          {labelOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </div>

      <div className="image-auto-mark-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleUseCurrentFrame}>
          Use current frame
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={handleSubmit}>
          Auto-mark range
        </button>
      </div>

      <p className="text-muted image-auto-mark-hint">
        Mark {MIN_AUTO_MARK_REFERENCES}+ reference frames by hand, pick a point, then fill target
        frames using the average x/y shift between references.
      </p>
    </div>
  );
}
