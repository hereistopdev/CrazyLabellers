const { Readable } = require('stream');

function isBlockedHostname(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return true;
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') {
    return true;
  }
  if (host.endsWith('.local')) return true;
  if (host === 'metadata.google.internal' || host === '169.254.169.254') return true;
  return false;
}

function isBlockedIpv4(hostname) {
  const parts = String(hostname || '').split('.');
  if (parts.length !== 4) return false;
  const nums = parts.map((part) => Number(part));
  if (nums.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  if (nums[0] === 10) return true;
  if (nums[0] === 127) return true;
  if (nums[0] === 169 && nums[1] === 254) return true;
  if (nums[0] === 172 && nums[1] >= 16 && nums[1] <= 31) return true;
  if (nums[0] === 192 && nums[1] === 168) return true;
  return false;
}

function validateProxyTargetUrl(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) {
    throw new Error('Missing video URL');
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid video URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http(s) video URLs are allowed');
  }

  if (isBlockedHostname(parsed.hostname) || isBlockedIpv4(parsed.hostname)) {
    throw new Error('Video URL host is not allowed');
  }

  return parsed.toString();
}

async function proxyVideoResponse(targetUrl, req, res) {
  const headers = {};
  if (req.headers.range) {
    headers.Range = req.headers.range;
  }

  const upstream = await fetch(targetUrl, { headers, redirect: 'follow' });
  if (!upstream.ok && upstream.status !== 206) {
    return res.status(upstream.status).json({ message: 'Could not fetch video from source' });
  }

  res.status(upstream.status);

  for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  }

  if (!res.getHeader('content-type')) {
    res.setHeader('Content-Type', 'video/mp4');
  }

  res.setHeader('Cache-Control', 'private, max-age=3600');

  if (!upstream.body) {
    return res.end();
  }

  return Readable.fromWeb(upstream.body).pipe(res);
}

module.exports = {
  validateProxyTargetUrl,
  proxyVideoResponse,
};
