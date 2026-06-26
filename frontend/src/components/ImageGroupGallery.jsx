import { resolveImageUrl } from '../utils/imageUrl';

export default function ImageGroupGallery({
  images = [],
  selectedId,
  onSelect,
  labelableIds = null,
}) {
  return (
    <div className="image-group-gallery card">
      <div className="image-group-gallery-header">
        <h3>Gallery</h3>
        <span className="text-muted">{images.length} frames</span>
      </div>
      <div className="image-group-gallery-grid">
        {images.map((image, index) => {
          const canLabel = !labelableIds || labelableIds.has(image._id);
          const isSelected = image._id === selectedId;
          const complete = image.isComplete || image.markedCount >= image.requiredCount;
          const submitted =
            image.submissionStatus === 'submitted' ||
            image.status === 'submitted' ||
            image.status === 'approved';

          return (
            <button
              key={image._id}
              type="button"
              className={`image-group-gallery-item${isSelected ? ' selected' : ''}${complete ? ' complete' : ''}${submitted ? ' submitted' : ''}${!canLabel ? ' locked' : ''}`}
              onClick={() => onSelect(image._id)}
              title={image.title || image.imageId}
            >
              <img src={resolveImageUrl(image.imageUrl)} alt={image.title} loading="eager" decoding="async" />
              <span className="image-group-gallery-index">{index + 1}</span>
              {complete && <span className="image-group-gallery-badge">✓</span>}
              {!canLabel && <span className="image-group-gallery-lock">🔒</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
