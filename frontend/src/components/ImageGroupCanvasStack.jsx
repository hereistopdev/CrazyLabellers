import { useCallback } from 'react';
import ImageKeypointCanvas from './ImageKeypointCanvas';
import { resolveImageUrl } from '../utils/imageUrl';

export default function ImageGroupCanvasStack({
  images = [],
  selectedId,
  keypointsById = {},
  activeLabel,
  showMagnifier = false,
  magnifierZoom = 3,
  onPlacePoint,
  onDragPoint,
  onSelectLabel,
  onImageDimensions,
}) {
  const activeImage = images.find((image) => String(image._id) === String(selectedId));
  const activeImageId = activeImage ? String(activeImage._id) : '';

  const handleImageDimensions = useCallback(
    (dims) => {
      if (activeImageId) onImageDimensions?.(activeImageId, dims);
    },
    [activeImageId, onImageDimensions]
  );

  return (
    <div className="image-group-canvas-stack">
      <div className="image-group-canvas-preload" aria-hidden>
        {images.map((image) => (
          <img
            key={image._id}
            src={resolveImageUrl(image.imageUrl)}
            alt=""
            decoding="async"
          />
        ))}
      </div>

      {activeImage ? (
        <div className="image-group-canvas-layer active">
          <ImageKeypointCanvas
            key={activeImage._id}
            imageUrl={resolveImageUrl(activeImage.imageUrl)}
            keypoints={keypointsById[String(activeImage._id)]?.keypoints || {}}
            activeLabel={activeLabel}
            isActive
            showMagnifier={showMagnifier}
            magnifierZoom={magnifierZoom}
            onPlacePoint={onPlacePoint}
            onDragPoint={onDragPoint}
            onSelectLabel={onSelectLabel}
            onImageDimensions={handleImageDimensions}
          />
        </div>
      ) : (
        <div className="empty-state">Select a frame from the gallery</div>
      )}
    </div>
  );
}
