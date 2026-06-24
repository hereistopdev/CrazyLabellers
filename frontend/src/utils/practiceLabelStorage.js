import { normalizeVideoUrl } from './videoUrl';

function storageKey(videoUrl) {
  return `practice-labels:${normalizeVideoUrl(videoUrl)}`;
}

export function loadPracticeLabels(videoUrl) {
  if (!videoUrl) return { events: [] };
  try {
    const raw = localStorage.getItem(storageKey(videoUrl));
    if (!raw) return { events: [] };
    const parsed = JSON.parse(raw);
    return {
      events: Array.isArray(parsed?.events) ? parsed.events : [],
      savedAt: parsed?.savedAt || null,
    };
  } catch {
    return { events: [] };
  }
}

export function savePracticeLabels(videoUrl, events) {
  if (!videoUrl) return;
  localStorage.setItem(
    storageKey(videoUrl),
    JSON.stringify({
      events: events || [],
      savedAt: new Date().toISOString(),
    })
  );
}

export function clearPracticeLabels(videoUrl) {
  if (!videoUrl) return;
  localStorage.removeItem(storageKey(videoUrl));
}
