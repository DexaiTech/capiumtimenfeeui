import { formatMoney } from '@/utils/money';

import type { WipAges } from '../types';
import { ageSegments } from '../utils/format';

export interface AgeBarProps {
  ages: WipAges;
  /** What the bar is about, for its accessible name ("Ageing of Acme Ltd"). */
  label: string;
  currency: string;
}

/** The ageing buckets of a row as one stacked bar; a dash when there is no WIP. */
export function AgeBar({ ages, label, currency }: AgeBarProps) {
  const segments = ageSegments(ages);
  if (segments.length === 0) return <span className="text-xs text-text-muted">—</span>;
  const summary = segments
    .filter((segment) => segment.value > 0)
    .map((segment) => `${segment.label}: ${formatMoney(segment.value, currency)}`)
    .join(', ');
  return (
    <div
      role="img"
      aria-label={`${label}: ${summary}`}
      className="flex h-2 w-full min-w-28 overflow-hidden rounded-full bg-surface-hover"
    >
      {segments.map((segment) =>
        segment.percent > 0 ? (
          <span
            key={segment.key}
            className="h-full"
            style={{ width: `${String(segment.percent)}%`, backgroundColor: segment.cssColor }}
          />
        ) : null,
      )}
    </div>
  );
}
