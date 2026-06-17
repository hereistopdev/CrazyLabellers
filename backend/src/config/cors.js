function getAllowedOrigins() {
  const origins = new Set();

  if (process.env.CLIENT_URL) {
    origins.add(process.env.CLIENT_URL.trim());
  }

  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean)
      .forEach((o) => origins.add(o));
  }

  return origins;
}

function isAllowedOrigin(origin) {
  if (!origin) return true;

  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
    return true;
  }

  const allowed = getAllowedOrigins();
  if (allowed.has(origin)) {
    return true;
  }

  // Vercel production and preview deployments
  if (/^https:\/\/[\w.-]+\.vercel\.app$/.test(origin)) {
    return true;
  }

  return false;
}

module.exports = { getAllowedOrigins, isAllowedOrigin };
