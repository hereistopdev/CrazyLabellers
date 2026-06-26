import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { IMAGE_KEYPOINT_LABELS } from '../config/imageKeypoints';

const MAGNIFIER_SIZE = 150;
const MAGNIFIER_ZOOM_LEVELS = [2, 3, 4];
const OFFSET = 20;

export { MAGNIFIER_ZOOM_LEVELS };

/** Map object-fit: contain layout (element box vs painted image pixels). */
function getContainedImageLayout(img) {
  const elementRect = img.getBoundingClientRect();
  const naturalWidth = img.naturalWidth;
  const naturalHeight = img.naturalHeight;
  if (!naturalWidth || !naturalHeight || !elementRect.width || !elementRect.height) {
    return null;
  }

  const scale = Math.min(elementRect.width / naturalWidth, elementRect.height / naturalHeight);
  const renderW = naturalWidth * scale;
  const renderH = naturalHeight * scale;
  const offsetX = (elementRect.width - renderW) / 2;
  const offsetY = (elementRect.height - renderH) / 2;

  return {
    elementRect,
    naturalWidth,
    naturalHeight,
    renderW,
    renderH,
    offsetX,
    offsetY,
    scale,
  };
}

export default function ImageKeypointCanvas({
  imageUrl,
  keypoints = {},
  activeLabel,
  isActive = true,
  showMagnifier = false,
  magnifierZoom = 3,
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

  const updateImageSize = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const layout = getContainedImageLayout(img);
    if (layout) {
      setImageSize({
        width: layout.renderW,
        height: layout.renderH,
        offsetX: layout.offsetX,
        offsetY: layout.offsetY,
      });
      onImageDimensions?.({
        width: layout.naturalWidth,
        height: layout.naturalHeight,
      });
    }
  }, [onImageDimensions]);

  useEffect(() => {
    window.addEventListener('resize', updateImageSize);
    return () => window.removeEventListener('resize', updateImageSize);
  }, [updateImageSize]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return undefined;

    const observer = new ResizeObserver(() => {
      updateImageSize();
    });
    observer.observe(img);

    return () => observer.disconnect();
  }, [imageUrl, updateImageSize]);

  useLayoutEffect(() => {
    if (!isActive) return;
    updateImageSize();
    const frame = requestAnimationFrame(updateImageSize);
    return () => cancelAnimationFrame(frame);
  }, [isActive, imageUrl, updateImageSize]);

  const toNormalized = useCallback((clientX, clientY) => {
    const img = imgRef.current;
    if (!img) return null;
    const layout = getContainedImageLayout(img);
    if (!layout) return null;

    const relX = clientX - layout.elementRect.left - layout.offsetX;
    const relY = clientY - layout.elementRect.top - layout.offsetY;
    // Small tolerance for sub-pixel rounding at image edges.
    if (relX < -1 || relY < -1 || relX > layout.renderW + 1 || relY > layout.renderH + 1) {
      return null;
    }
    const x = Math.max(0, Math.min(1, relX / layout.renderW));
    const y = Math.max(0, Math.min(1, relY / layout.renderH));
    return { x, y };
  }, []);

  const drawLens = useCallback(
    (clientX, clientY) => {
      const img = imgRef.current;
      const lens = lensRef.current;
      if (!showMagnifier || !isActive || !img || !lens || !img.naturalWidth) {
        setLensVisible(false);
        return;
      }

      const layout = getContainedImageLayout(img);
      if (!layout) {
        setLensVisible(false);
        return;
      }

      const relX = clientX - layout.elementRect.left;
      const relY = clientY - layout.elementRect.top;
      const contentX = relX - layout.offsetX;
      const contentY = relY - layout.offsetY;

      if (
        contentX < 0 ||
        contentY < 0 ||
        contentX > layout.renderW ||
        contentY > layout.renderH
      ) {
        setLensVisible(false);
        return;
      }

      let left = clientX + OFFSET;
      let top = clientY + OFFSET;
      if (left + MAGNIFIER_SIZE > window.innerWidth) left = clientX - MAGNIFIER_SIZE - OFFSET;
      if (top + MAGNIFIER_SIZE > window.innerHeight) top = clientY - MAGNIFIER_SIZE - OFFSET;

      setLensPos({ left, top });
      setLensVisible(true);

      const ctx = lens.getContext('2d');
      if (!ctx) return;

      const zoom = MAGNIFIER_ZOOM_LEVELS.includes(magnifierZoom) ? magnifierZoom : 3;

      lens.width = MAGNIFIER_SIZE;
      lens.height = MAGNIFIER_SIZE;

      // Crop in display pixels so 2×/3×/4× matches what the labeller sees on screen.
      const cropDisplaySize = MAGNIFIER_SIZE / zoom;
      const srcW = cropDisplaySize / layout.scale;
      const srcH = cropDisplaySize / layout.scale;
      const cx = (contentX / layout.renderW) * layout.naturalWidth;
      const cy = (contentY / layout.renderH) * layout.naturalHeight;
      const sx = Math.max(0, Math.min(layout.naturalWidth - srcW, cx - srcW / 2));
      const sy = Math.max(0, Math.min(layout.naturalHeight - srcH, cy - srcH / 2));

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
    [showMagnifier, isActive, magnifierZoom]
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (!showMagnifier || !isActive) return;
      drawLens(event.clientX, event.clientY);
    },
    [showMagnifier, isActive, drawLens]
  );

  const handleStagePointerDown = (event) => {
    if (!isActive || !activeLabel || dragLabel) return;
    if (event.target.closest('.image-keypoint-marker')) return;
    const point = toNormalized(event.clientX, event.clientY);
    if (point) {
      event.preventDefault();
      onPlacePoint?.(activeLabel, point);
    }
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

  useEffect(() => {
    if (!showMagnifier || !isActive) setLensVisible(false);
  }, [showMagnifier, isActive]);

  return (
    <div className="image-keypoint-canvas-wrap" ref={containerRef}>
      <div
        className="image-keypoint-canvas-stage"
        onPointerDown={handleStagePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setLensVisible(false)}
        role="presentation"
      >
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
            const left = (imageSize.offsetX || 0) + point.x * imageSize.width;
            const top = (imageSize.offsetY || 0) + point.y * imageSize.height;
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
      {showMagnifier && isActive && (
        <canvas
          ref={lensRef}
          className={`image-cursor-magnifier-lens${lensVisible ? ' visible' : ''}`}
          style={{ left: `${lensPos.left}px`, top: `${lensPos.top}px` }}
          aria-hidden
        />
      )}
    </div>
  );
}
