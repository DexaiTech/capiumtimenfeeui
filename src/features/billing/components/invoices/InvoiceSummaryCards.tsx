import { Card } from '@/components/ui';
import { cn } from '@/utils/cn';
import { formatMoney } from '@/utils/money';

import type { InvoiceListSummary } from '../../types';

export interface InvoiceSummaryCardsProps {
  /** Undefined while loading or when the caller may not see it: nothing is drawn. */
  summary: InvoiceListSummary | undefined;
  currency: string;
}

/** What is owed, what is overdue and what waits for approval, for the filters of the list. */
export function InvoiceSummaryCards({ summary, currency }: InvoiceSummaryCardsProps) {
  if (!summary) return null;
  const money = (pence: number) => formatMoney(pence, currency);
  const figures = [
    { label: 'Outstanding', value: money(summary.outstanding), alert: false },
    { label: 'Overdue', value: money(summary.overdue), alert: summary.overdue > 0 },
    { label: 'Awaiting approval', value: money(summary.awaiting_approval_gross), alert: false },
  ];
  return (
    <Card padding="sm">
      <dl aria-label="Invoice figures" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {figures.map((figure) => (
          <div key={figure.label} className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium text-text-muted">{figure.label}</dt>
            <dd
              className={cn(
                'text-base font-semibold tabular-nums',
                figure.alert ? 'text-danger' : 'text-text',
              )}
            >
              {figure.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
