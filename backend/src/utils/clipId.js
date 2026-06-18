const path = require('path');

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v'];

const VIDEO_EXTENSION_SET = new Set(VIDEO_EXTENSIONS.map((ext) => ext.toLowerCase()));

function getVideoExtension(filename) {
  const ext = path.extname(String(filename || '')).toLowerCase();
  return VIDEO_EXTENSION_SET.has(ext) ? ext : '.mp4';
}

function isVideoFilename(filename) {
  return VIDEO_EXTENSION_SET.has(path.extname(String(filename || '')).toLowerCase());
}

function isJsonFilename(filename) {
  return String(filename || '').toLowerCase().endsWith('.json');
}

function sanitizeClipId(value) {
  const stem = String(value || '')
    .trim()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  return stem.slice(0, 120) || null;
}

function isSafeClipId(clipId) {
  if (!clipId || typeof clipId !== 'string') return false;
  if (clipId.length > 120) return false;
  if (clipId.includes('..') || /[\\/]/.test(clipId)) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(clipId);
}

function clipIdFromFilename(filename) {
  const stem = path.basename(String(filename || ''), path.extname(String(filename || '')));
  return sanitizeClipId(stem);
}

function isSafeVideoFilename(filename) {
  const base = path.basename(String(filename || ''));
  if (!base || base.includes('..')) return false;
  const ext = path.extname(base).toLowerCase();
  const stem = path.basename(base, ext);
  return VIDEO_EXTENSION_SET.has(ext) && isSafeClipId(stem);
}

module.exports = {
  VIDEO_EXTENSIONS,
  getVideoExtension,
  isVideoFilename,
  isJsonFilename,
  sanitizeClipId,
  isSafeClipId,
  clipIdFromFilename,
  isSafeVideoFilename,
};
