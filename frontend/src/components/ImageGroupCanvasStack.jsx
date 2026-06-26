import ImageKeypointCanvas from './ImageKeypointCanvas';
import { resolveImageUrl } from '../utils/imageUrl';

export default function ImageGroupCanvasStack({
  images = [],
  selectedId,
  keypointsById = {},
  activeLabel,
  showMagnifier = false,
  onPlacePoint,
  onDragPoint,
  onImageDimensions,
}) {
  return (
    <div className="image-group-canvas-stack">
      {images.map((image) => {
        const isActive = image._id === selectedId;
        const keypoints = keypointsById[image._id]?.keypoints || {};
        return (
          <div
            key={image._id}
            className={`image-group-canvas-layer${isActive ? ' active' : ''}`}
            aria-hidden={!isActive}
          >
            <ImageKeypointCanvas
              imageUrl={resolveImageUrl(image.imageUrl)}
              keypoints={keypoints}
              activeLabel={activeLabel}
              isActive={isActive}
              showMagnifier={showMagnifier}
              onPlacePoint={onPlacePoint}
              onDragPoint={onDragPoint}
              onImageDimensions={
                isActive ? (dims) => onImageDimensions?.(image._id, dims) : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}
