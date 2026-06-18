export function formatMoney(amount, currency = 'USD') {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

export function isFreeTaskKind(kind) {
  return kind === 'tutorial' || kind === 'pretest';
}

export function effectiveTaskPrice(assignmentOrKind, taskPrice) {
  const kind =
    typeof assignmentOrKind === 'string' ? assignmentOrKind : assignmentOrKind?.kind;
  if (isFreeTaskKind(kind)) {
    return 0;
  }
  const price =
    taskPrice ??
    (typeof assignmentOrKind === 'object' ? assignmentOrKind?.taskPrice : undefined);
  return price != null ? price : 1;
}

export function calcTaskEarnings(reviewPoints, taskPrice, ratePerPoint = 0.1, kind) {
  const points = Math.max(0, Math.min(100, reviewPoints || 0));
  const price = effectiveTaskPrice(kind, taskPrice);
  if (price > 0) {
    return Math.round(price * (points / 100) * 100) / 100;
  }
  return 0;
}
