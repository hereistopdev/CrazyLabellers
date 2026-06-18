const DEFAULT_RATE_PER_POINT = 0.1;
const DEFAULT_TASK_PRICE = 1;
const MIN_TASK_PRICE = 0.3;
const MAX_TASK_PRICE = 2;
const FREE_TASK_KINDS = ['tutorial', 'pretest'];

function isFreeTaskKind(kind) {
  return FREE_TASK_KINDS.includes(kind);
}

function getRatePerPoint() {
  return parseFloat(process.env.PAY_RATE_PER_POINT) || DEFAULT_RATE_PER_POINT;
}

function clampReviewPoints(reviewPoints) {
  return Math.max(0, Math.min(100, reviewPoints || 0));
}

function effectiveTaskPrice(assignmentOrKind, taskPrice) {
  const kind =
    typeof assignmentOrKind === 'string' ? assignmentOrKind : assignmentOrKind?.kind;
  if (isFreeTaskKind(kind)) {
    return 0;
  }
  const price = taskPrice ?? (typeof assignmentOrKind === 'object' ? assignmentOrKind?.taskPrice : undefined);
  return price != null ? price : DEFAULT_TASK_PRICE;
}

function validateTaskPrice(price, { kind } = {}) {
  if (kind && isFreeTaskKind(kind)) {
    return 0;
  }

  const value = parseFloat(price);
  if (Number.isNaN(value)) {
    throw new Error(`Task price must be between $${MIN_TASK_PRICE} and $${MAX_TASK_PRICE}`);
  }
  if (value === 0) {
    throw new Error('Production task price must be between $0.30 and $2.00');
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

function calculateTaskEarnings(reviewPoints, taskPrice, ratePerPoint = getRatePerPoint(), kind) {
  const points = clampReviewPoints(reviewPoints);
  const price = effectiveTaskPrice(kind, taskPrice);
  if (price > 0) {
    return Math.round(price * (points / 100) * 100) / 100;
  }
  return 0;
}

module.exports = {
  DEFAULT_RATE_PER_POINT,
  DEFAULT_TASK_PRICE,
  MIN_TASK_PRICE,
  MAX_TASK_PRICE,
  FREE_TASK_KINDS,
  isFreeTaskKind,
  effectiveTaskPrice,
  getRatePerPoint,
  clampReviewPoints,
  validateTaskPrice,
  calculateEarnings,
  calculateTaskEarnings,
};
