function getMediaBaseUrl() {
  const media = import.meta.env.VITE_MEDIA_URL || '';
  if (media.startsWith('http')) {
    return media.replace(/\/$/, '');
  }
  return '';
}

function getApiOrigin() {
  const base = import.meta.env.VITE_API_URL || '';
  if (!base.startsWith('http')) return '';

  try {
    return new URL(base).origin;
  } catch {
    return '';
  }
}

function extractImagePath(imageUrl) {
  const trimmed = String(imageUrl || '').trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('/api/images/')) return trimmed;

  const match = trimmed.match(/\/api\/images\/[^?#]+/);
  return match ? match[0] : '';
}

export function resolveImageUrl(imageUrl) {
  const trimmed = String(imageUrl || '').trim();
  if (!trimmed) return '';

  // Full URL — load directly from media server (same as videos)
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const imagePath = extractImagePath(trimmed);
  if (!imagePath) return trimmed;

  const mediaBase = getMediaBaseUrl();
  if (mediaBase) {
    return `${mediaBase}${imagePath}`;
  }

  const apiOrigin = getApiOrigin();
  if (apiOrigin) {
    return `${apiOrigin}${imagePath}`;
  }

  return imagePath;
}

export function isCrossOriginImageUrl(imageUrl) {
  const resolved = resolveImageUrl(imageUrl);
  if (!resolved || resolved.startsWith('/')) return false;

  try {
    const parsed = new URL(resolved);
    return parsed.origin !== window.location.origin;
  } catch {
    return false;
  }
}

export function imageGroupPath(groupId, imageId) {
  const routeId = groupId || 'ungrouped';
  const base = `/image-groups/${routeId}`;
  return imageId ? `${base}?image=${encodeURIComponent(imageId)}` : base;
}

/** @deprecated Use imageGroupPath */
export function imageLabelPath(assignmentId) {
  return `/label-image/${assignmentId}`;
}
