const DEFAULT_RATE_PER_POINT = 0.1;
const DEFAULT_TASK_PRICE = 1;
const MIN_TASK_PRICE = 0.3;
const MAX_TASK_PRICE = 2;

function getRatePerPoint() {
  return parseFloat(process.env.PAY_RATE_PER_POINT) || DEFAULT_RATE_PER_POINT;
}

function clampReviewPoints(reviewPoints) {
  return Math.max(0, Math.min(100, reviewPoints || 0));
}

function validateTaskPrice(price) {
  const value = parseFloat(price);
  if (Number.isNaN(value)) {
    throw new Error(`Task price must be between $${MIN_TASK_PRICE} and $${MAX_TASK_PRICE}`);
  }
  if (value < MIN_TASK_PRICE || value > MAX_TASK_PRICE) {
    throw new Error(`Task price must be between $${MIN_TASK_PRICE} and $${MAX_TASK_PRICE}`);
  }
  return Math.round(value * 100) / 100;
}

function calculateEarnings(reviewPoints, ratePerPoint = getRatePerPoint()) {
  const points = clampReviewPoints(reviewPoints);
  return Math.round(points * ratePerPoint * 100) / 100;
}

function calculateTaskEarnings(reviewPoints, taskPrice, ratePerPoint = getRatePerPoint()) {
  const points = clampReviewPoints(reviewPoints);
  if (taskPrice != null && taskPrice > 0) {
    return Math.round(taskPrice * (points / 100) * 100) / 100;
  }
  return calculateEarnings(points, ratePerPoint);
}

module.exports = {
  DEFAULT_RATE_PER_POINT,
  DEFAULT_TASK_PRICE,
  MIN_TASK_PRICE,
  MAX_TASK_PRICE,
  getRatePerPoint,
  clampReviewPoints,
  validateTaskPrice,
  calculateEarnings,
  calculateTaskEarnings,
};
