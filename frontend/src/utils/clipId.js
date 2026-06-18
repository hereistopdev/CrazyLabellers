const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v'];
const VIDEO_EXTENSION_SET = new Set(VIDEO_EXTENSIONS.map((ext) => ext.toLowerCase()));

export function getVideoExtension(filename) {
  const match = String(filename || '').toLowerCase().match(/(\.[a-z0-9]+)$/);
  const ext = match ? match[1] : '.mp4';
  return VIDEO_EXTENSION_SET.has(ext) ? ext : '.mp4';
}

export function isVideoFilename(filename) {
  return VIDEO_EXTENSION_SET.has(getVideoExtension(filename));
}

export function isJsonFilename(filename) {
  return String(filename || '').toLowerCase().endsWith('.json');
}

export function sanitizeClipId(value) {
  const stem = String(value || '')
    .trim()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  return stem.slice(0, 120) || null;
}

export function isSafeClipId(clipId) {
  if (!clipId || typeof clipId !== 'string') return false;
  if (clipId.length > 120) return false;
  if (clipId.includes('..') || /[\\/]/.test(clipId)) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(clipId);
}

export { VIDEO_EXTENSIONS };
