import { BADGE_TIER_LABELS, formatBadgeBonus } from '../utils/labellerBadges';

export default function LabellerBadges({
  badges = [],
  showLocked = true,
  compact = false,
  jobsCompleted = 0,
}) {
  const visible = showLocked ? badges : badges.filter((badge) => badge.earned);

  if (visible.length === 0) {
    return (
      <p className="labeller-badges-empty">
        Complete approved production tasks to earn your first badge.
      </p>
    );
  }

  return (
    <div className={`labeller-badges${compact ? ' labeller-badges--compact' : ''}`}>
      {visible.map((badge) => (
        <div
          key={badge.id}
          className={`labeller-badge labeller-badge--${badge.tier}${badge.earned ? ' earned' : ' locked'}`}
          title={
            badge.earned
              ? `${badge.title} — bonus ${formatBadgeBonus(badge)}`
              : `${badge.title} — ${badge.remaining} more approved task${badge.remaining === 1 ? '' : 's'} (${badge.clipThreshold} total)`
          }
        >
          <div className="labeller-badge-icon" aria-hidden="true">
            {badge.icon}
          </div>
          <div className="labeller-badge-body">
            <div className="labeller-badge-title">{badge.title}</div>
            <div className="labeller-badge-meta">
              <span className="labeller-badge-tier">{BADGE_TIER_LABELS[badge.tier] || badge.tier}</span>
              <span className="labeller-badge-threshold">{badge.clipThreshold} clips</span>
            </div>
            {!badge.earned && showLocked && (
              <div className="labeller-badge-progress" aria-hidden="true">
                <div className="labeller-badge-progress-bar" style={{ width: `${badge.progress}%` }} />
              </div>
            )}
            <div className="labeller-badge-bonus">
              {badge.earned ? `+${formatBadgeBonus(badge)} bonus` : `Bonus ${formatBadgeBonus(badge)}`}
            </div>
          </div>
        </div>
      ))}
      {!compact && jobsCompleted > 0 && (
        <p className="labeller-badges-footnote">
          {jobsCompleted} approved production task{jobsCompleted === 1 ? '' : 's'} counted toward badges.
        </p>
      )}
    </div>
  );
}
