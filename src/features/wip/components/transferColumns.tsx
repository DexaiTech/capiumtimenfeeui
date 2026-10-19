import { ArrowRight } from 'lucide-react';

import { Badge, type DataTableColumn } from '@/components/ui';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { COMPONENT_LABEL, TRANSFER_STATUS_META } from '../constants';
import type { Transfer } from '../types';
import { jobText, personName } from '../utils/format';

/** The columns of the list of transfers. */
export function transferColumns(currency: string): DataTableColumn<Transfer>[] {
  return [
    {
      id: 'date',
      header: 'Effective',
      className: 'whitespace-nowrap',
      cell: (row) => <span className="text-text">{formatUkDate(row.effective_date)}</span>,
    },
    {
      id: 'client',
      header: 'Client',
      className: 'min-w-40 max-w-64',
      cell: (row) => (
        <span className="block truncate font-semibold text-text" title={row.client?.name}>
          {row.client?.name ?? '—'}
        </span>
      ),
    },
    {
      id: 'jobs',
      header: 'From and to',
      className: 'min-w-64 max-w-96',
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-1.5 text-text">
          <span className="truncate" title={jobText(row.from_job)}>
            {jobText(row.from_job)}
          </span>
          <ArrowRight aria-label="to" className="size-3.5 shrink-0 text-text-muted" />
          <span className="truncate" title={jobText(row.to_job)}>
            {jobText(row.to_job)}
          </span>
        </span>
      ),
    },
    {
      id: 'component',
      header: 'Kind of WIP',
      className: 'whitespace-nowrap',
      cell: (row) => <span className="text-text">{COMPONENT_LABEL[row.component]}</span>,
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <span className="font-semibold text-text tabular-nums">
          {formatMoney(row.amount, currency)}
        </span>
      ),
    },
    {
      id: 'items',
      header: 'Moved',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <span className="text-text">
          {row.items.length === 0
            ? 'An amount'
            : row.items.length === 1
              ? '1 item'
              : `${String(row.items.length)} items`}
        </span>
      ),
    },
    {
      id: 'reason',
      header: 'Reason',
      className: 'min-w-56 max-w-96',
      cell: (row) => (
        <span className="block truncate text-text" title={row.reason}>
          {row.reason}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <Badge tone={TRANSFER_STATUS_META[row.status].tone} size="sm" dot>
          {TRANSFER_STATUS_META[row.status].label}
        </Badge>
      ),
    },
    {
      id: 'by',
      header: 'By',
      className: 'whitespace-nowrap',
      cell: (row) => <span className="text-text">{personName(row.created_by)}</span>,
    },
  ];
}
