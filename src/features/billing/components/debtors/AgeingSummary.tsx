import { chartColorVar } from '@/components/charts';
import { Card } from '@/components/ui';
import { formatBasisPoints, formatMoney } from '@/utils/money';

import { AGEING_LABELS } from '../../constants';
import { AGEING_BUCKETS, type AgeingAmounts } from '../../types';

const share = (part: number, whole: number) =>
  whole > 0 ? formatBasisPoints(Math.round((part / whole) * 10_000)) : '0%';

export interface AgeingBarProps {
  amounts: AgeingAmounts;
  /** What the bar is about, for its accessible name. */
  label: string;
  currency: string;
}

/** The five ageing buckets as one stacked bar; a dash when nothing is owed. */
export function AgeingBar({ amounts, label, currency }: AgeingBarProps) {
  const total = AGEING_BUCKETS.reduce((sum, bucket) => sum + Math.max(0, amounts[bucket]), 0);
  if (total <= 0) return <span className="text-xs text-text-muted">—</span>;
  const summary = AGEING_BUCKETS.filter((bucket) => amounts[bucket] > 0)
    .map((bucket) => `${AGEING_LABELS[bucket].label}: ${formatMoney(amounts[bucket], currency)}`)
    .join(', ');
  return (
    <div
      role="img"
      aria-label={`${label}: ${summary}`}
      className="flex h-2 w-full min-w-28 overflow-hidden rounded-full bg-surface-hover"
    >
      {AGEING_BUCKETS.map((bucket) =>
        amounts[bucket] > 0 ? (
          <span
            key={bucket}
            className="h-full"
            style={{
              width: `${String((Math.max(0, amounts[bucket]) / total) * 100)}%`,
              backgroundColor: chartColorVar(AGEING_LABELS[bucket].color),
            }}
          />
        ) : null,
      )}
    </div>
  );
}

export interface AgeingSummaryProps {
  amounts: AgeingAmounts & { total: number };
  currency: string;
}

/** What is owed, by how late it is: the bar and, under it, each bucket with its share. */
export function AgeingSummary({ amounts, currency }: AgeingSummaryProps) {
  return (
    <Card padding="sm" className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-text">Ageing of what is owed</h2>
      <AgeingBar amounts={amounts} label="Ageing of what is owed" currency={currency} />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
        {AGEING_BUCKETS.map((bucket) => (
          <div key={bucket} className="flex flex-col gap-0.5">
            <dt className="flex items-center gap-1.5 text-xs text-text-muted">
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ backgroundColor: chartColorVar(AGEING_LABELS[bucket].color) }}
              />
              {AGEING_LABELS[bucket].label}
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-text">
              {formatMoney(amounts[bucket], currency)}
            </dd>
            <dd className="text-2xs text-text-subtle">{share(amounts[bucket], amounts.total)}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
