import { formatMoney } from './money';

export const BADGE_TIER_LABELS = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  emerald: 'Elite',
};

export function formatBadgeBonus(badge) {
  return formatMoney(badge?.bonusAmount ?? 0);
}
