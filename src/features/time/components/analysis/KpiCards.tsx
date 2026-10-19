import { Skeleton } from '@/components/ui';
import { formatMinutes } from '@/utils/minutes';
import { formatBasisPoints, formatMoney } from '@/utils/money';

import type { TimeAmounts } from '../../types';
import { valueLessCost } from '../../utils/analysis';

export interface KpiCardsProps {
  /** Absent while the first load runs. */
  totals: TimeAmounts | undefined;
  currency: string;
}

interface Kpi {
  label: string;
  value: string;
  hint?: string;
}

/**
 * The totals of the range: time, how much of it is chargeable, its value and, for people who may
 * see rates, the cost and what is left of the value after it.
 */
export function KpiCards({ totals, currency }: KpiCardsProps) {
  const margin = totals ? valueLessCost(totals) : null;
  const cards: Kpi[] = totals
    ? [
        {
          label: 'Total time',
          value: formatMinutes(totals.total_minutes),
          hint: `${totals.entry_count} ${totals.entry_count === 1 ? 'entry' : 'entries'}`,
        },
        { label: 'Chargeable time', value: formatMinutes(totals.chargeable_minutes) },
        { label: 'Non-chargeable time', value: formatMinutes(totals.non_chargeable_minutes) },
        { label: 'Chargeable share', value: formatBasisPoints(totals.chargeable_bp) },
        {
          label: 'Value',
          value: formatMoney(totals.charge_value, currency),
          hint: 'of the chargeable time',
        },
        ...(totals.cost_value === null
          ? []
          : [
              { label: 'Cost', value: formatMoney(totals.cost_value, currency) },
              {
                label: 'Value less cost',
                value: margin === null ? '—' : formatMoney(margin, currency),
              },
            ]),
      ]
    : [];

  return (
    <ul
      aria-label="Time totals"
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]"
    >
      {totals
        ? cards.map((card) => (
            <li
              key={card.label}
              className="flex flex-col gap-0.5 rounded-xl border border-border bg-surface p-4 shadow-card"
            >
              <span className="text-xs font-medium text-text-muted">{card.label}</span>
              <span className="text-xl font-semibold text-text tabular-nums">{card.value}</span>
              {card.hint ? <span className="text-2xs text-text-muted">{card.hint}</span> : null}
            </li>
          ))
        : Array.from({ length: 5 }, (_, index) => (
            <li
              key={index}
              aria-hidden="true"
              className="rounded-xl border border-border bg-surface p-4 shadow-card"
            >
              <Skeleton lines={2} />
            </li>
          ))}
    </ul>
  );
}
