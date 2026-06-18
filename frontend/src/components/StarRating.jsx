export default function StarRating({ value = 0, onChange, size = 'md', readOnly = false }) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <span className={`star-rating star-rating-${size}${readOnly ? ' star-rating-readonly' : ''}`}>
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          className={`star-btn${star <= value ? ' filled' : ''}`}
          disabled={readOnly}
          onClick={() => !readOnly && onChange?.(star)}
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}
