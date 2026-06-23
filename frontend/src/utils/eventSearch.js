export function normalizeEventSearchText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');
}

export function matchesEventSearch(query, eventType) {
  const q = normalizeEventSearchText(query);
  if (!q) return false;

  const label = normalizeEventSearchText(eventType);
  const compact = label.replace(/\s+/g, '');
  const queryCompact = q.replace(/\s+/g, '');

  return (
    label.includes(q) ||
    compact.includes(queryCompact) ||
    label.replace(/\s+/g, '_').includes(q.replace(/\s+/g, '_'))
  );
}

export function countEventSearchMatches(query, events = []) {
  if (!normalizeEventSearchText(query)) return 0;
  return events.filter((event) => matchesEventSearch(query, event.eventType)).length;
}
