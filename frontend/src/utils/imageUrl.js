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

  const imagePath = extractImagePath(trimmed);
  const apiOrigin = getApiOrigin();

  if (imagePath && apiOrigin) {
    return `${apiOrigin}${imagePath}`;
  }

  if (imagePath) return imagePath;
  return trimmed;
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
