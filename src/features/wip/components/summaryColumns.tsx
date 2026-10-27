import { Link } from 'react-router';

import { InitialsAvatar, type DataTableColumn } from '@/components/ui';
import { modulePath, ORG_SEGMENTS } from '@/constants/routes';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { AGE_BUCKETS, GROUP_META } from '../constants';
import type { WipGroup, WipGroupRow } from '../types';
import { shareText } from '../utils/format';
import { AgeBar } from './AgeBar';

export interface SummaryColumnsOptions {
  slug: string;
  currency: string;
  group: WipGroup;
  /** The caller may prepare invoices: a client row then offers "Bill" (`invoice.create`). */
  canBill?: boolean;
}

// A plain string: the grid colours it by its column (time, fixed fee, expense, total).
const amount = (pence: number, currency: string) => formatMoney(pence, currency);

const oldest = (row: WipGroupRow) =>
  row.oldest_date ? (
    <span className="whitespace-nowrap text-text">{formatUkDate(row.oldest_date)}</span>
  ) : (
    <span className="text-text-muted">—</span>
  );

/** The first column: what the row stands for, linking to the items behind it. */
function nameColumn({ slug, group }: SummaryColumnsOptions): DataTableColumn<WipGroupRow> {
  const meta = GROUP_META[group];
  const secondary = (row: WipGroupRow) =>
    group === 'job' ? (row.client?.name ?? row.code) : row.code;
  return {
    id: 'name',
    header: meta.column,
    hideable: false,
    sortable: true,
    className: 'min-w-52 max-w-80',
    cell: (row) => {
      const detail = secondary(row);
      const content = (
        <>
          <InitialsAvatar name={row.name} size="sm" />
          <span className="flex min-w-0 flex-col gap-[3px]">
            <span
              className={`truncate text-xs font-semibold text-text${group === 'client' ? ' uppercase' : ''}`}
              title={row.name}
            >
              {row.name}
            </span>
            {detail ? <span className="truncate text-2xs text-text-muted">{detail}</span> : null}
          </span>
        </>
      );
      return row.key ? (
        <Link
          to={`${modulePath(slug, ORG_SEGMENTS.wip, 'details')}?${meta.filter}=${encodeURIComponent(row.key)}`}
          className="flex min-w-0 items-center gap-1.5 hover:text-brand-text"
          aria-label={`${row.name}: see the WIP items`}
        >
          {content}
        </Link>
      ) : (
        <div className="flex min-w-0 items-center gap-1.5">{content}</div>
      );
    },
  };
}

/** WIP by time, fixed fee and expense, with the oldest item and the share over 90 days. */
export function summaryColumns(options: SummaryColumnsOptions): DataTableColumn<WipGroupRow>[] {
  const { currency, slug, group, canBill = false } = options;
  return [
    nameColumn(options),
    {
      id: 'time',
      header: 'Time WIP',
      align: 'end',
      sortable: true,
      className: 'whitespace-nowrap',
      cell: (row) => amount(row.time, currency),
    },
    {
      id: 'fixed_fee',
      header: 'Fixed fee WIP',
      align: 'end',
      sortable: true,
      className: 'whitespace-nowrap',
      cell: (row) => amount(row.fixed_fee, currency),
    },
    {
      id: 'expense',
      header: 'Expense WIP',
      align: 'end',
      sortable: true,
      className: 'whitespace-nowrap',
      cell: (row) => amount(row.expense, currency),
    },
    {
      id: 'total',
      header: 'Total WIP',
      align: 'end',
      sortable: true,
      className: 'whitespace-nowrap font-semibold',
      cell: (row) => amount(row.total, currency),
    },
    {
      id: 'hours',
      header: 'Hours',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (row) => row.hours,
    },
    {
      id: 'oldest',
      header: 'Oldest item',
      sortable: true,
      className: 'whitespace-nowrap',
      cell: oldest,
    },
    {
      id: 'over_90',
      header: 'Over 90 days',
      align: 'end',
      sortable: true,
      className: 'whitespace-nowrap',
      cell: (row) =>
        `${formatMoney(row.ages.days_90_plus, currency)} (${shareText(row.over_90_bp)})`,
    },
    {
      id: 'items',
      header: 'Items',
      align: 'end',
      sortable: true,
      cell: (row) => <span className="text-text tabular-nums">{row.item_count}</span>,
    },
    // One click from the client's WIP to its invoice, with the client already chosen.
    ...(canBill && group === 'client'
      ? [
          {
            id: 'bill',
            header: 'Bill',
            hideable: false,
            align: 'end' as const,
            cell: (row: WipGroupRow) =>
              row.key && row.total > 0 ? (
                <Link
                  to={`${modulePath(slug, ORG_SEGMENTS.billing, 'prepare')}?client=${encodeURIComponent(row.key)}`}
                  aria-label={`Bill ${row.name}`}
                  className="font-semibold whitespace-nowrap text-brand-text hover:underline"
                >
                  Bill
                </Link>
              ) : null,
          },
        ]
      : []),
  ];
}

/** WIP by the age of its items: one column for each ageing bucket and a bar across them. */
export function ageingColumns(options: SummaryColumnsOptions): DataTableColumn<WipGroupRow>[] {
  const { currency } = options;
  return [
    nameColumn(options),
    ...AGE_BUCKETS.map((bucket): DataTableColumn<WipGroupRow> => ({
      id: bucket.key,
      header: bucket.label,
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (row) => amount(row.ages[bucket.key], currency),
    })),
    {
      id: 'total',
      header: 'Total WIP',
      align: 'end',
      sortable: true,
      className: 'whitespace-nowrap font-semibold',
      cell: (row) => amount(row.total, currency),
    },
    {
      id: 'over_90',
      header: 'Over 90 days',
      align: 'end',
      sortable: true,
      className: 'whitespace-nowrap',
      cell: (row) => <span className="text-text tabular-nums">{shareText(row.over_90_bp)}</span>,
    },
    {
      id: 'oldest',
      header: 'Oldest item',
      sortable: true,
      className: 'whitespace-nowrap',
      cell: oldest,
    },
    {
      id: 'ageing',
      header: 'Ageing',
      className: 'w-40',
      cell: (row) => <AgeBar ages={row.ages} label={`Ageing of ${row.name}`} currency={currency} />,
    },
  ];
}
