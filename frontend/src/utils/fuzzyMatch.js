export const MATCH_THRESHOLD = 0.8;

export function normalizeMatchKey(name) {
  return String(name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/_post$/i, '')
    .replace(/_old$/i, '')
    .replace(/_raw$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

export function nameSimilarity(left, right) {
  const a = normalizeMatchKey(left);
  const b = normalizeMatchKey(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

export function classifyJsonVariant(filename) {
  const lower = String(filename || '').toLowerCase();
  if (!lower.endsWith('.json')) return null;
  if (lower.endsWith('_post.json')) return 'raw';
  return 'post';
}

export function pickBestMatch(targetName, candidates, usedKeys, threshold = MATCH_THRESHOLD) {
  let best = null;

  for (const candidate of candidates) {
    const key = candidate.key || candidate.name;
    if (usedKeys.has(key)) continue;

    const score = nameSimilarity(targetName, candidate.name);
    if (score < threshold) continue;
    if (!best || score > best.score) {
      best = { ...candidate, score };
    }
  }

  return best;
}
