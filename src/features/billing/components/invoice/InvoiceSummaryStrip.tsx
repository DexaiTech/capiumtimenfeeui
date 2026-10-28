import { Card } from '@/components/ui';
import { cn } from '@/utils/cn';
import { formatMoney } from '@/utils/money';

import type { InvoiceDetail } from '../../types';

interface Figure {
  label: string;
  value: string;
  strong?: boolean;
  alert?: boolean;
  /** Money received: drawn in green. */
  good?: boolean;
}

/** The figures of an invoice at a glance: net, VAT, total, paid, credited and what is still owed. */
export function InvoiceSummaryStrip({ invoice }: { invoice: InvoiceDetail }) {
  const money = (pence: number) => formatMoney(pence, invoice.currency);
  const issued = invoice.status === 'issued';
  const figures: Figure[] = [
    { label: 'Net', value: money(invoice.net_total) },
    { label: 'VAT', value: money(invoice.vat_total) },
    { label: 'Total', value: money(invoice.gross_total), strong: true },
    {
      label: 'Paid',
      value: issued ? money(invoice.paid_total) : '—',
      good: invoice.paid_total > 0,
    },
    {
      label: 'Credited',
      value: issued ? money(invoice.credited_total) : '—',
      alert: issued && invoice.credited_total > 0,
    },
    {
      label: 'Outstanding',
      value: issued ? money(invoice.balance) : '—',
      strong: true,
      alert: issued && invoice.balance > 0,
    },
  ];
  return (
    <Card padding="sm">
      <dl
        aria-label="Invoice totals"
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
      >
        {figures.map((figure) => (
          <div key={figure.label} className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium text-text-muted">{figure.label}</dt>
            <dd
              className={cn(
                'text-base tabular-nums',
                figure.strong ? 'font-semibold text-text' : 'font-medium text-text',
                figure.alert && 'text-danger',
                figure.good && 'text-success',
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
