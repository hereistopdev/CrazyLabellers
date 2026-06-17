const DEFAULT_RATE_PER_POINT = 0.1;

function getRatePerPoint() {
  return parseFloat(process.env.PAY_RATE_PER_POINT) || DEFAULT_RATE_PER_POINT;
}

function calculateEarnings(reviewPoints, ratePerPoint = getRatePerPoint()) {
  const points = Math.max(0, Math.min(100, reviewPoints || 0));
  return Math.round(points * ratePerPoint * 100) / 100;
}

module.exports = { DEFAULT_RATE_PER_POINT, getRatePerPoint, calculateEarnings };
