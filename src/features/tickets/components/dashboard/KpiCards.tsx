import { ArrowDown, ArrowUp } from 'lucide-react';

import { Skeleton } from '@/components/ui';
import { cn } from '@/utils/cn';

import { KPI_CARDS } from '../../constants';
import type { TicketDashboard } from '../../types';
import { changeLine } from '../../utils/format';

export interface KpiCardsProps {
  /** Absent while the first load runs. */
  kpis: TicketDashboard['kpis'] | undefined;
}

/**
 * The six cards of the dashboard: an icon badge, the number, the label and how the number moved
 * against the previous period of the same length (green up arrow, red down arrow).
 */
export function KpiCards({ kpis }: KpiCardsProps) {
  return (
    <ul aria-label="Ticket totals" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {KPI_CARDS.map((card) => {
        const Icon = card.icon;
        const kpi = kpis?.[card.key];
        const line = kpi ? changeLine(kpi.change) : null;
        const up = line?.direction !== 'down';
        return (
          <li key={card.key} className={cn('flex flex-col gap-3 rounded-xl p-4', card.tone.soft)}>
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-full',
                  card.tone.strong,
                  card.tone.text,
                )}
              >
                <Icon className="size-5" />
              </span>
              <div className="flex min-w-0 flex-col">
                {kpi ? (
                  <span className="text-2xl leading-tight font-semibold text-text tabular-nums">
                    {kpi.value}
                  </span>
                ) : (
                  <Skeleton shape="rect" className="h-7 w-12" />
                )}
                <span className="text-xs font-medium text-text-muted">{card.label}</span>
              </div>
            </div>
            {line ? (
              <p
                className={cn(
                  'flex items-center gap-1 text-2xs font-medium',
                  up ? 'text-success' : 'text-danger',
                )}
              >
                {up ? (
                  <ArrowUp aria-hidden="true" className="size-3" />
                ) : (
                  <ArrowDown aria-hidden="true" className="size-3" />
                )}
                <span className="sr-only">{up ? 'Up' : 'Down'}</span>
                {line.text} vs last period
              </p>
            ) : (
              <Skeleton className="w-3/4" />
            )}
          </li>
        );
      })}
    </ul>
  );
}
