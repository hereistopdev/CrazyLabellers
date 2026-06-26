import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { IMAGE_KEYPOINT_LABELS } from '../config/imageKeypoints';
import { isCrossOriginImageUrl, resolveImageUrl } from '../utils/imageUrl';

const MAGNIFIER_SIZE = 450;
const MAGNIFIER_ZOOM_LEVELS = [2, 3, 4];

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
  onDragBegin,
  onSelectLabel,
  onImageDimensions,
}) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const lensRef = useRef(null);
  const onImageDimensionsRef = useRef(onImageDimensions);
  const lastNaturalSizeRef = useRef({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [dragLabel, setDragLabel] = useState(null);
  const [lensVisible, setLensVisible] = useState(false);
  const [lensCoords, setLensCoords] = useState(null);
  const resolvedImageUrl = useMemo(() => resolveImageUrl(imageUrl), [imageUrl]);
  const crossOrigin = useMemo(
    () => (isCrossOriginImageUrl(resolvedImageUrl) ? 'anonymous' : undefined),
    [resolvedImageUrl]
  );

  useEffect(() => {
    onImageDimensionsRef.current = onImageDimensions;
  }, [onImageDimensions]);

  useEffect(() => {
    lastNaturalSizeRef.current = { width: 0, height: 0 };
    setImageSize({ width: 0, height: 0, offsetX: 0, offsetY: 0 });
    setLensVisible(false);
    setLensCoords(null);
  }, [resolvedImageUrl]);

  const updateImageSize = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const layout = getContainedImageLayout(img);
    if (layout) {
      setImageSize((prev) => {
        if (
          prev.width === layout.renderW &&
          prev.height === layout.renderH &&
          prev.offsetX === layout.offsetX &&
          prev.offsetY === layout.offsetY
        ) {
          return prev;
        }
        return {
          width: layout.renderW,
          height: layout.renderH,
          offsetX: layout.offsetX,
          offsetY: layout.offsetY,
        };
      });
      if (
        lastNaturalSizeRef.current.width !== layout.naturalWidth ||
        lastNaturalSizeRef.current.height !== layout.naturalHeight
      ) {
        lastNaturalSizeRef.current = {
          width: layout.naturalWidth,
          height: layout.naturalHeight,
        };
        onImageDimensionsRef.current?.({
          width: layout.naturalWidth,
          height: layout.naturalHeight,
        });
      }
    }
  }, []);

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
    if (relX < -1 || relY < -1 || relX > layout.renderW + 1 || relY > layout.renderH + 1) {
      return null;
    }
    const x = Math.max(0, Math.min(1, relX / layout.renderW));
    const y = Math.max(0, Math.min(1, relY / layout.renderH));
    return { x, y };
  }, []);

  const drawLensAtNormalized = useCallback(
    (normX, normY) => {
      const img = imgRef.current;
      const lens = lensRef.current;
      if (!showMagnifier || !isActive || !img || !lens || !img.naturalWidth) {
        setLensVisible(false);
        setLensCoords(null);
        return;
      }

      const layout = getContainedImageLayout(img);
      if (!layout) {
        setLensVisible(false);
        setLensCoords(null);
        return;
      }

      const x = Math.max(0, Math.min(1, normX));
      const y = Math.max(0, Math.min(1, normY));
      const pixelX = Math.round(x * layout.naturalWidth);
      const pixelY = Math.round(y * layout.naturalHeight);

      setLensCoords({ x: pixelX, y: pixelY, normX: x, normY: y });
      setLensVisible(true);

      const ctx = lens.getContext('2d');
      if (!ctx) return;

      const zoom = MAGNIFIER_ZOOM_LEVELS.includes(magnifierZoom) ? magnifierZoom : 3;

      lens.width = MAGNIFIER_SIZE;
      lens.height = MAGNIFIER_SIZE;

      const cropDisplaySize = MAGNIFIER_SIZE / zoom;
      const srcW = cropDisplaySize / layout.scale;
      const srcH = cropDisplaySize / layout.scale;
      const cx = x * layout.naturalWidth;
      const cy = y * layout.naturalHeight;
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

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2, 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.stroke();

      ctx.restore();
    },
    [showMagnifier, isActive, magnifierZoom]
  );

  const activePoint = activeLabel ? keypoints[activeLabel] : null;

  useEffect(() => {
    if (!showMagnifier || !isActive) {
      setLensVisible(false);
      setLensCoords(null);
      return;
    }
    if (activePoint) {
      drawLensAtNormalized(activePoint.x, activePoint.y);
    }
  }, [showMagnifier, isActive, activePoint, activeLabel, drawLensAtNormalized]);

  const handlePointerMove = useCallback(
    (event) => {
      if (!showMagnifier || !isActive || activePoint) return;
      const point = toNormalized(event.clientX, event.clientY);
      if (point) drawLensAtNormalized(point.x, point.y);
    },
    [showMagnifier, isActive, activePoint, toNormalized, drawLensAtNormalized]
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
    onSelectLabel?.(label);
    onDragBegin?.(label);
    setDragLabel(label);
  };

  useEffect(() => {
    if (!dragLabel) return undefined;

    const handleMove = (event) => {
      const point = toNormalized(event.clientX, event.clientY);
      if (point) onDragPoint?.(dragLabel, point);
    };

    const handleUp = () => setDragLabel(null);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragLabel, onDragPoint, toNormalized]);

  return (
    <div className="image-keypoint-canvas-wrap" ref={containerRef}>
      {showMagnifier && isActive && (
        <div className="image-keypoint-magnifier-dock">
          <canvas
            ref={lensRef}
            className={`image-cursor-magnifier-lens image-cursor-magnifier-lens--docked${lensVisible ? ' visible' : ''}`}
            aria-hidden
          />
          {lensVisible && lensCoords && (
            <div className="image-cursor-magnifier-coords image-cursor-magnifier-coords--docked">
              x: {lensCoords.x}, y: {lensCoords.y}
            </div>
          )}
        </div>
      )}

      <div
        className="image-keypoint-canvas-stage"
        onPointerDown={handleStagePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => {
          if (activePoint) {
            drawLensAtNormalized(activePoint.x, activePoint.y);
            return;
          }
          setLensVisible(false);
          setLensCoords(null);
        }}
        role="presentation"
      >
        <img
          ref={imgRef}
          src={resolvedImageUrl}
          alt="Labeling target"
          crossOrigin={crossOrigin}
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
                  '--marker-color': meta.color,
                }}
                onPointerDown={(event) => handlePointerDown(meta.id, event)}
                aria-label={meta.name}
                title={meta.name}
              />
            );
          })}
      </div>
    </div>
  );
}
