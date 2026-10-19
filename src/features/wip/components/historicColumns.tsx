import { Link } from 'react-router';

import { Badge, type DataTableColumn } from '@/components/ui';
import { cn } from '@/utils/cn';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { BILLING_TYPE_LABEL, HISTORIC_GROUP_META, ITEM_KIND_META } from '../constants';
import type { HistoricGroup, HistoricItem, HistoricRow } from '../types';
import { ageTone, daysText } from '../utils/format';
import { AgeBar } from './AgeBar';

export interface HistoricColumnsOptions {
  currency: string;
  group: HistoricGroup;
}

const amount = (pence: number, currency: string) => (
  <span className="text-text tabular-nums">{formatMoney(pence, currency)}</span>
);

/** The columns of the historic WIP report: the three WIPs, what was written on and off, the ages. */
export function historicColumns({
  currency,
  group,
}: HistoricColumnsOptions): DataTableColumn<HistoricRow>[] {
  const secondary = (row: HistoricRow) =>
    group === 'job' ? (row.client?.name ?? row.code) : group === 'client' ? row.code : null;
  return [
    {
      id: 'name',
      header: HISTORIC_GROUP_META[group].column,
      hideable: false,
      className: 'min-w-52 max-w-80',
      cell: (row) => {
        const detail = secondary(row);
        const name =
          group === 'billing_type' ? (BILLING_TYPE_LABEL[row.key ?? ''] ?? row.name) : row.name;
        return (
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-semibold text-text" title={name}>
              {name}
            </span>
            {detail ? <span className="truncate text-xs text-text-muted">{detail}</span> : null}
          </div>
        );
      },
    },
    {
      id: 'time',
      header: 'Time WIP',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (row) => amount(row.time_wip, currency),
    },
    {
      id: 'fixed_fee',
      header: 'Fixed fee WIP',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (row) => amount(row.fixed_fee_wip, currency),
    },
    {
      id: 'expense',
      header: 'Expense WIP',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (row) => amount(row.expense_wip, currency),
    },
    {
      id: 'write_ons',
      header: 'Write-ons',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (row) => amount(row.write_ons, currency),
    },
    {
      id: 'write_offs',
      header: 'Write-offs',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (row) => amount(row.write_offs, currency),
    },
    {
      id: 'total',
      header: 'Total WIP',
      align: 'end',
      className: 'font-semibold whitespace-nowrap',
      cell: (row) => amount(row.total, currency),
    },
    {
      id: 'ageing',
      header: 'Ageing',
      className: 'w-40',
      cell: (row) => <AgeBar ages={row.ages} label={`Ageing of ${row.name}`} currency={currency} />,
    },
    {
      id: 'oldest',
      header: 'Oldest item',
      className: 'whitespace-nowrap',
      cell: (row) =>
        row.oldest_date ? (
          <span className="text-text">{formatUkDate(row.oldest_date)}</span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: 'hours',
      header: 'Hours',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (row) => <span className="text-text tabular-nums">{row.hours}</span>,
    },
    {
      id: 'items',
      header: 'Items',
      align: 'end',
      cell: (row) => <span className="text-text tabular-nums">{row.item_count}</span>,
    },
  ];
}

export interface HistoricItemColumnsOptions {
  slug: string;
  currency: string;
  canOpenJob: boolean;
  jobHref: (jobId: string) => string;
}

/** The items behind a row of the historic report. */
export function historicItemColumns({
  currency,
  canOpenJob,
  jobHref,
}: HistoricItemColumnsOptions): DataTableColumn<HistoricItem>[] {
  return [
    {
      id: 'date',
      header: 'Date',
      className: 'whitespace-nowrap',
      cell: (item) => <span className="text-text">{formatUkDate(item.date)}</span>,
    },
    {
      id: 'client',
      header: 'Client',
      className: 'min-w-36 max-w-56',
      cell: (item) => (
        <span className="block truncate text-text" title={item.client.name}>
          {item.client.name}
        </span>
      ),
    },
    {
      id: 'job',
      header: 'Job',
      className: 'min-w-36 max-w-56',
      cell: (item) => {
        if (!item.job_id) return <span className="text-text-muted">—</span>;
        const label = [item.job_number, item.job_name].filter(Boolean).join(' ');
        return canOpenJob ? (
          <Link
            to={jobHref(item.job_id)}
            className="block truncate text-text hover:text-brand-text"
            title={label}
          >
            {label}
          </Link>
        ) : (
          <span className="block truncate text-text" title={label}>
            {label}
          </span>
        );
      },
    },
    {
      id: 'item',
      header: 'Item',
      className: 'min-w-48 max-w-80',
      cell: (item) => (
        <span className="flex items-center gap-2">
          <Badge tone={ITEM_KIND_META[item.kind].tone} size="sm">
            {ITEM_KIND_META[item.kind].label}
          </Badge>
          {item.description ? (
            <span className="truncate text-text" title={item.description}>
              {item.description}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'value',
      header: 'Value',
      align: 'end',
      className: 'font-semibold whitespace-nowrap',
      cell: (item) => (
        <span className={cn('tabular-nums', item.value < 0 ? 'text-danger' : 'text-text')}>
          {formatMoney(item.value, currency)}
        </span>
      ),
    },
    {
      id: 'age',
      header: 'Age that day',
      className: 'whitespace-nowrap',
      cell: (item) => (
        <Badge tone={ageTone(item.age_days)} size="sm">
          {daysText(item.age_days)}
        </Badge>
      ),
    },
  ];
}
