export function resolveImageUrl(imageUrl) {
  const trimmed = String(imageUrl || '').trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('/api/images/')) return trimmed;

  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.pathname.startsWith('/api/images/')) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // not a full URL
  }

  return trimmed;
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
