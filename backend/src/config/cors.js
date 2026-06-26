function normalizeOrigin(origin) {
  if (!origin) return '';
  return origin.trim().replace(/\/$/, '');
}

function parseOriginList(value) {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((entry) => normalizeOrigin(entry))
    .filter(Boolean);
}

function originHostname(origin) {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function getConfiguredOrigins() {
  return [
    ...parseOriginList(process.env.CLIENT_URL),
    ...parseOriginList(process.env.ALLOWED_ORIGINS),
  ];
}

function getAllowedOrigins() {
  const origins = new Set();

  for (const origin of getConfiguredOrigins()) {
    for (const variant of originVariants(origin)) {
      origins.add(variant);
    }
  }

  return origins;
}

const PROJECT_DEFAULT_DOMAINS = ['crazylabel.us'];

function getAllowedDomains() {
  const domains = new Set(PROJECT_DEFAULT_DOMAINS);

  for (const origin of getConfiguredOrigins()) {
    const hostname = originHostname(origin);
    if (hostname) domains.add(hostname);
  }

  for (const domain of parseOriginList(process.env.CORS_ALLOWED_DOMAINS)) {
    const hostname = originHostname(domain.includes('://') ? domain : `https://${domain}`);
    if (hostname) domains.add(hostname);
  }

  return domains;
}

function originVariants(origin) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return [];

  const variants = new Set([normalized]);
  if (normalized.startsWith('https://www.')) {
    variants.add(normalized.replace('https://www.', 'https://'));
  } else if (normalized.startsWith('https://')) {
    variants.add(normalized.replace('https://', 'https://www.'));
  } else if (normalized.startsWith('http://www.')) {
    variants.add(normalized.replace('http://www.', 'http://'));
  } else if (normalized.startsWith('http://')) {
    variants.add(normalized.replace('http://', 'http://www.'));
  }
  return [...variants];
}

function hostnameMatchesAllowedDomain(hostname, allowedDomains) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return false;

  for (const domain of allowedDomains) {
    if (host === domain || host.endsWith(`.${domain}`)) {
      return true;
    }
  }

  return false;
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

  const allowedDomains = getAllowedDomains();
  if (
    allowedDomains.size > 0 &&
    variants.some((o) => hostnameMatchesAllowedDomain(originHostname(o), allowedDomains))
  ) {
    return true;
  }

  // Vercel production, preview, and branch deployments
  if (variants.some((o) => /^https:\/\/(www\.)?[\w.-]+\.vercel\.app$/.test(o))) {
    return true;
  }

  return false;
}

function describeCorsConfig() {
  const origins = [...getAllowedOrigins()];
  const domains = [...getAllowedDomains()];
  return {
    origins,
    domains,
    vercelAppWildcard: true,
    localhost: true,
  };
}

module.exports = {
  getAllowedOrigins,
  getAllowedDomains,
  isAllowedOrigin,
  normalizeOrigin,
  originVariants,
  describeCorsConfig,
};
