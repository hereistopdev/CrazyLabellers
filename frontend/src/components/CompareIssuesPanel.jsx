import { useMemo } from 'react';
import { FPS } from '../config/frameOffsets';
import { formatEventTime } from '../utils/frameTime';

export function buildCompareAttentionItems(comparison) {
  if (!comparison) return [];
  const items = [];

  for (const item of comparison.matched || []) {
    if ((item.frameDiff ?? 0) >= 2) {
      items.push({
        key: `off-${item.submissionIndex}-${item.referenceIndex}`,
        label: `${item.eventType} · ${item.frameDiff}f off`,
        time: item.submissionTime,
        kind: 'off',
      });
    }
  }
  for (const item of comparison.missingInSubmission || []) {
    items.push({
      key: `missing-${item.referenceIndex}`,
      label: `${item.eventType} · missing`,
      time: item.frameTime,
      kind: 'missing',
    });
  }
  for (const item of comparison.extraInSubmission || []) {
    items.push({
      key: `extra-${item.submissionIndex}`,
      label: `${item.eventType} · new`,
      time: item.frameTime,
      kind: 'extra',
    });
  }

  return items.sort((a, b) => a.time - b.time);
}

export function countOffFrameIssues(comparison) {
  return (comparison?.matched || []).filter((item) => (item.frameDiff ?? 0) >= 2).length;
}

function formatTime(seconds, fps = FPS) {
  return formatEventTime(seconds, fps);
}

export default function CompareIssuesPanel({
  comparison,
  onSeek,
  fps = FPS,
  previewMode = false,
  embedded = false,
  className = '',
}) {
  const attentionItems = useMemo(() => buildCompareAttentionItems(comparison), [comparison]);
  const offFrameCount = useMemo(() => countOffFrameIssues(comparison), [comparison]);

  if (previewMode || !comparison) return null;

  const panel = (
    <div className={`review-attention-panel review-compare-sidebar-panel${embedded ? ' review-compare-embedded' : ''}`}>
      <div className="review-attention-title">
        Compare issues
        {offFrameCount > 0 && (
          <>
            {' '}
            — {offFrameCount} matched event{offFrameCount !== 1 ? 's' : ''} ≥2 frames off
          </>
        )}
        {comparison?.summary?.missingCount > 0 &&
          ` · ${comparison.summary.missingCount} missing`}
        {comparison?.summary?.extraCount > 0 && ` · ${comparison.summary.extraCount} new`}
      </div>
      {attentionItems.length > 0 ? (
        <div className="review-attention-chips review-compare-sidebar-chips">
          {attentionItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`review-attention-chip review-attention-chip-${item.kind}`}
              onClick={() => onSeek(item.time)}
            >
              {item.label} @ {formatTime(item.time, fps)}
            </button>
          ))}
        </div>
      ) : (
        <p className="review-compare-empty">No frame mismatches, missing, or new events.</p>
      )}
    </div>
  );

  if (embedded) {
    return panel;
  }

  return (
    <aside className={`review-compare-sidebar${className ? ` ${className}` : ''}`}>
      {panel}
    </aside>
  );
}
