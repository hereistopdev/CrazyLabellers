export function normalizeVideoUrl(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${pathname}${parsed.search}`;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

export function isOpenableVideoUrl(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return false;

  if (/\/label\/[a-f0-9]{24}/i.test(trimmed)) return true;

  try {
    const parsed = new URL(trimmed);
    if (!/^https?:$/i.test(parsed.protocol)) return false;
    const path = parsed.pathname.split('/').pop() || '';
    if (/\.(mp4|webm|mov|m4v)$/i.test(path)) return true;
    if (/\/chunks\//i.test(parsed.pathname)) return true;
    if (/\/api\/videos\//i.test(parsed.pathname)) return true;
    return false;
  } catch {
    return /^\/api\/videos\//i.test(trimmed) || /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(trimmed);
  }
}

export function extractClipIdFromVideoUrl(input) {
  const chunksMatch = String(input).match(/\/chunks\/([^/?#]+)/i);
  if (chunksMatch) {
    return decodeURIComponent(chunksMatch[1]).replace(/\.[^.]+$/i, '');
  }

  const apiMatch = String(input).match(/\/api\/videos\/([^/?#]+)/i);
  if (apiMatch) {
    return decodeURIComponent(apiMatch[1]).replace(/\.[^.]+$/i, '');
  }

  try {
    const parsed = new URL(input, 'http://placeholder.local');
    const pathBase = parsed.pathname.split('/').pop() || '';
    if (/\.(mp4|webm|mov|m4v)$/i.test(pathBase)) {
      return decodeURIComponent(pathBase).replace(/\.[^.]+$/i, '');
    }
  } catch {
    // not a full URL
  }

  const basename = String(input).split('/').pop()?.split('?')[0] || '';
  if (/\.(mp4|webm|mov|m4v)$/i.test(basename)) {
    return basename.replace(/\.[^.]+$/i, '');
  }

  return null;
}

export function practiceLabelPath(videoUrl) {
  return `/label/practice?url=${encodeURIComponent(String(videoUrl || '').trim())}`;
}

export function extractAssignmentIdFromLabelUrl(input) {
  const match = String(input).match(/\/label\/([a-f0-9]{24})/i);
  return match ? match[1] : null;
}
