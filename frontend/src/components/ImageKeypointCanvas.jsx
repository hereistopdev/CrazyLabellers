import { useCallback, useEffect, useRef, useState } from 'react';
import { IMAGE_KEYPOINT_LABELS } from '../config/imageKeypoints';

const MAGNIFIER_SIZE = 132;
const ZOOM = 3;
const OFFSET = 20;

export default function ImageKeypointCanvas({
  imageUrl,
  keypoints = {},
  activeLabel,
  isActive = true,
  showMagnifier = false,
  onPlacePoint,
  onDragPoint,
  onImageDimensions,
}) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const lensRef = useRef(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [dragLabel, setDragLabel] = useState(null);
  const [lensVisible, setLensVisible] = useState(false);
  const [lensPos, setLensPos] = useState({ left: 0, top: 0 });
  const rafRef = useRef(null);

  const updateImageSize = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    setImageSize({ width: img.clientWidth, height: img.clientHeight });
    if (img.naturalWidth && img.naturalHeight) {
      onImageDimensions?.({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    }
  }, [onImageDimensions]);

  useEffect(() => {
    window.addEventListener('resize', updateImageSize);
    return () => window.removeEventListener('resize', updateImageSize);
  }, [updateImageSize]);

  const toNormalized = useCallback((clientX, clientY) => {
    const img = imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x, y };
  }, []);

  const drawLens = useCallback(
    (clientX, clientY) => {
      const wrap = containerRef.current;
      const img = imgRef.current;
      const lens = lensRef.current;
      if (!showMagnifier || !isActive || !wrap || !img || !lens || !img.naturalWidth) return;

      const rect = wrap.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const imgRect = img.getBoundingClientRect();
      const relX = clientX - imgRect.left;
      const relY = clientY - imgRect.top;

      if (relX < 0 || relY < 0 || relX > imgRect.width || relY > imgRect.height) {
        setLensVisible(false);
        return;
      }

      const nx = relX / imgRect.width;
      const ny = relY / imgRect.height;

      let left = localX + OFFSET;
      let top = localY + OFFSET;
      if (left + MAGNIFIER_SIZE > rect.width) left = localX - MAGNIFIER_SIZE - OFFSET;
      if (top + MAGNIFIER_SIZE > rect.height) top = localY - MAGNIFIER_SIZE - OFFSET;
      setLensPos({ left, top });
      setLensVisible(true);

      const ctx = lens.getContext('2d');
      if (!ctx) return;

      lens.width = MAGNIFIER_SIZE;
      lens.height = MAGNIFIER_SIZE;

      const srcW = img.naturalWidth / ZOOM;
      const srcH = img.naturalHeight / ZOOM;
      const sx = Math.max(0, Math.min(img.naturalWidth - srcW, nx * img.naturalWidth - srcW / 2));
      const sy = Math.max(0, Math.min(img.naturalHeight - srcH, ny * img.naturalHeight - srcH / 2));

      ctx.clearRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);
      ctx.save();
      ctx.beginPath();
      ctx.arc(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2 - 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, sx, sy, srcW, srcH, 0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2 - 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(MAGNIFIER_SIZE / 2, 0);
      ctx.lineTo(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE);
      ctx.moveTo(0, MAGNIFIER_SIZE / 2);
      ctx.lineTo(MAGNIFIER_SIZE, MAGNIFIER_SIZE / 2);
      ctx.stroke();
      ctx.restore();
    },
    [showMagnifier, isActive]
  );

  const handleMouseMove = useCallback(
    (event) => {
      if (!showMagnifier || !isActive) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => drawLens(event.clientX, event.clientY));
    },
    [showMagnifier, isActive, drawLens]
  );

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  const handleImageClick = (event) => {
    if (!isActive || !activeLabel || dragLabel) return;
    const point = toNormalized(event.clientX, event.clientY);
    if (point) onPlacePoint?.(activeLabel, point);
  };

  const handlePointerDown = (label, event) => {
    if (!isActive) return;
    event.stopPropagation();
    event.preventDefault();
    setDragLabel(label);
  };

  useEffect(() => {
    if (!dragLabel) return undefined;

    const handleMove = (event) => {
      const point = toNormalized(event.clientX, event.clientY);
      if (point) onDragPoint?.(dragLabel, point);
      drawLens(event.clientX, event.clientY);
    };

    const handleUp = () => setDragLabel(null);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragLabel, onDragPoint, toNormalized, drawLens]);

  return (
    <div
      className="image-keypoint-canvas-wrap"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setLensVisible(false)}
    >
      <div className="image-keypoint-canvas-stage" onClick={handleImageClick} role="presentation">
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Labeling target"
          onLoad={updateImageSize}
          draggable={false}
        />
        {imageSize.width > 0 &&
          IMAGE_KEYPOINT_LABELS.map((meta) => {
            const point = keypoints[meta.id];
            if (!point) return null;
            const left = point.x * imageSize.width;
            const top = point.y * imageSize.height;
            const isLabelActive = activeLabel === meta.id;
            return (
              <button
                key={meta.id}
                type="button"
                className={`image-keypoint-marker${isLabelActive ? ' active' : ''}`}
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  borderColor: meta.color,
                  backgroundColor: `${meta.color}33`,
                }}
                onPointerDown={(event) => handlePointerDown(meta.id, event)}
                title={meta.name}
              >
                {meta.short}
              </button>
            );
          })}
      </div>
      {showMagnifier && isActive && lensVisible && (
        <canvas
          ref={lensRef}
          className="image-cursor-magnifier-lens"
          style={{ left: `${lensPos.left}px`, top: `${lensPos.top}px` }}
          aria-hidden
        />
      )}
    </div>
  );
}
