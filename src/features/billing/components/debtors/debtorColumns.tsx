import type { DataTableColumn } from '@/components/ui';
import { ClientName } from '@/components/ui';
import { cn } from '@/utils/cn';
import { formatMoney } from '@/utils/money';

import { AGEING_BUCKETS, type AgeingBucket, type DebtorRow } from '../../types';
import { dateCell, plural } from '../../utils/format';
import { AgeingBar } from './AgeingSummary';

export interface DebtorColumnOptions {
  currency: string;
}

const BUCKET_HEADER: Record<AgeingBucket, string> = {
  current: 'Current',
  days_1_30: '1–30 days',
  days_31_60: '31–60 days',
  days_61_90: '61–90 days',
  days_90_plus: '90+ days',
};

/** The column ids are the API's `sort` values, so a header click sorts on the server. */
export function debtorColumns({ currency }: DebtorColumnOptions): DataTableColumn<DebtorRow>[] {
  const bucketColumns = AGEING_BUCKETS.map((bucket): DataTableColumn<DebtorRow> => ({
    id: bucket,
    header: BUCKET_HEADER[bucket],
    align: 'end',
    sortable: true,
    className: 'whitespace-nowrap',
    cell: (row) =>
      row[bucket] === 0 ? (
        <span className="text-text-subtle">—</span>
      ) : (
        <span
          className={cn(
            'tabular-nums',
            bucket === 'days_90_plus' ? 'font-semibold text-danger' : 'text-text',
          )}
        >
          {formatMoney(row[bucket], currency)}
        </span>
      ),
  }));

  return [
    {
      id: 'client',
      header: 'Client',
      sortable: true,
      hideable: false,
      className: 'min-w-44 max-w-72',
      cell: (row) => <ClientName name={row.client.name} code={row.client.code} />,
    },
    {
      id: 'total',
      header: 'Total owed',
      align: 'end',
      sortable: true,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <span className="font-semibold tabular-nums text-text">
          {formatMoney(row.total, currency)}
        </span>
      ),
    },
    ...bucketColumns,
    {
      id: 'ageing',
      header: 'Ageing',
      className: 'w-40',
      cell: (row) => (
        <AgeingBar amounts={row} label={`Ageing of ${row.client.name}`} currency={currency} />
      ),
    },
    {
      id: 'oldest_due',
      header: 'Oldest due',
      sortable: true,
      className: 'whitespace-nowrap',
      cell: (row) =>
        row.oldest_due_date ? (
          <div className="flex flex-col">
            <span className="text-text">{dateCell(row.oldest_due_date)}</span>
            {row.max_days_overdue > 0 ? (
              <span className="text-xs text-danger">
                {plural(row.max_days_overdue, 'day', 'days')} overdue
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-text-subtle">—</span>
        ),
    },
    {
      id: 'invoices',
      header: 'Invoices',
      align: 'end',
      cell: (row) => <span className="tabular-nums text-text">{row.invoice_count}</span>,
    },
    {
      id: 'reminder',
      header: 'Last reminder',
      className: 'whitespace-nowrap',
      cell: (row) =>
        row.last_reminder_at ? (
          <span className="text-text">{dateCell(row.last_reminder_at.slice(0, 10))}</span>
        ) : (
          <span className="text-text-muted">Never</span>
        ),
    },
  ];
}
