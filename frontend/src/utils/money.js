export function formatMoney(amount, currency = 'USD') {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

export function calcTaskEarnings(reviewPoints, taskPrice, ratePerPoint = 0.1) {
  const points = Math.max(0, Math.min(100, reviewPoints || 0));
  if (taskPrice != null && taskPrice > 0) {
    return Math.round(taskPrice * (points / 100) * 100) / 100;
  }
  return Math.round(points * ratePerPoint * 100) / 100;
}
