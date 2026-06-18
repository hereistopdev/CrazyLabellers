const BADGE_BONUS_RATE = 0.02;

const VOLUME_BADGES = [
  { id: 'first_kickoff', title: 'First Kickoff', icon: '⚽', clipThreshold: 1, tier: 'bronze' },
  { id: 'warm_up_crew', title: 'Warm-Up Crew', icon: '🏃', clipThreshold: 5, tier: 'bronze' },
  { id: 'touchline_regular', title: 'Touchline Regular', icon: '📋', clipThreshold: 10, tier: 'bronze' },
  { id: 'frame_hunter', title: 'Frame Hunter', icon: '🎯', clipThreshold: 25, tier: 'silver' },
  { id: 'half_time_hero', title: 'Half-Time Hero', icon: '⏱️', clipThreshold: 50, tier: 'silver' },
  { id: 'century_club', title: 'Century Club', icon: '💯', clipThreshold: 100, tier: 'gold' },
  { id: 'press_box_pro', title: 'Press Box Pro', icon: '🎙️', clipThreshold: 250, tier: 'gold' },
  { id: 'tactical_analyst', title: 'Tactical Analyst', icon: '🧠', clipThreshold: 500, tier: 'gold' },
  { id: 'legend_of_the_line', title: 'Legend of the Line', icon: '👑', clipThreshold: 1000, tier: 'emerald' },
  { id: 'hall_of_frame', title: 'Hall of Frame', icon: '🏆', clipThreshold: 2500, tier: 'emerald' },
];

function badgeBonusAmount(clipThreshold) {
  return Math.round(BADGE_BONUS_RATE * clipThreshold * 100) / 100;
}

function enrichBadge(badge) {
  return {
    ...badge,
    bonusAmount: badgeBonusAmount(badge.clipThreshold),
  };
}

function getVolumeBadgeCatalog() {
  return VOLUME_BADGES.map(enrichBadge);
}

function getBadgeById(badgeId) {
  const badge = VOLUME_BADGES.find((item) => item.id === badgeId);
  return badge ? enrichBadge(badge) : null;
}

module.exports = {
  BADGE_BONUS_RATE,
  VOLUME_BADGES,
  badgeBonusAmount,
  getVolumeBadgeCatalog,
  getBadgeById,
};
