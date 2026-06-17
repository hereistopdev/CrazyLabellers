function normalizeOrigin(origin) {
  if (!origin) return '';
  return origin.trim().replace(/\/$/, '');
}

function getAllowedOrigins() {
  const origins = new Set();

  if (process.env.CLIENT_URL) {
    origins.add(normalizeOrigin(process.env.CLIENT_URL));
  }

  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',')
      .map((o) => normalizeOrigin(o))
      .filter(Boolean)
      .forEach((o) => origins.add(o));
  }

  return origins;
}

function originVariants(origin) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return [];

  const variants = new Set([normalized]);
  if (normalized.startsWith('https://www.')) {
    variants.add(normalized.replace('https://www.', 'https://'));
  } else if (normalized.startsWith('https://')) {
    variants.add(normalized.replace('https://', 'https://www.'));
  }
  return [...variants];
}

function isAllowedOrigin(origin) {
  const variants = originVariants(origin);

  if (variants.length === 0) {
    return true;
  }

  if (variants.some((o) => /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(o))) {
    return true;
  }

  const allowed = getAllowedOrigins();
  if (variants.some((o) => allowed.has(o))) {
    return true;
  }

  // Vercel production, preview, and branch deployments
  if (variants.some((o) => /^https:\/\/(www\.)?[\w.-]+\.vercel\.app$/.test(o))) {
    return true;
  }

  return false;
}

module.exports = { getAllowedOrigins, isAllowedOrigin, normalizeOrigin, originVariants };
