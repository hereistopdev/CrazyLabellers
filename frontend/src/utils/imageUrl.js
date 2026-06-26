export function resolveImageUrl(imageUrl) {
  const trimmed = String(imageUrl || '').trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('/api/images/')) return trimmed;

  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.pathname.startsWith('/api/images/')) {
      if (parsed.origin !== window.location.origin) {
        return trimmed;
      }
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // not a full URL
  }

  const legacyMatch = trimmed.match(/\/api\/images\/[^?#]+/);
  if (legacyMatch && !/^https?:\/\//i.test(trimmed)) {
    return legacyMatch[0];
  }

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
