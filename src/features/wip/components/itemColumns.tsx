import { Link } from 'react-router';

import { Badge, type DataTableColumn } from '@/components/ui';
import { routes } from '@/constants/routes';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { ITEM_KIND_META } from '../constants';
import type { WipItem } from '../types';
import { ageTone, daysText, jobText, personName } from '../utils/format';

export interface ItemColumnsOptions {
  slug: string;
  currency: string;
  /** Whether the caller may open a job (`job.read`). */
  canOpenJob: boolean;
}

/** What a fixed-fee item says about the fee: how much of it is WIP and why. */
function fixedFeeNote(item: WipItem, currency: string): string | null {
  const fee = item.fixed_fee;
  if (!fee) return null;
  return `Fee ${formatMoney(fee.fee, currency)}, recognised ${formatMoney(fee.recognised, currency)}, billed ${formatMoney(fee.billed, currency)}`;
}

/** The columns of the unbilled item list. */
export function itemColumns({
  slug,
  currency,
  canOpenJob,
}: ItemColumnsOptions): DataTableColumn<WipItem>[] {
  return [
    {
      id: 'date',
      header: 'Date',
      sortable: true,
      className: 'whitespace-nowrap',
      cell: (item) => <span className="text-text">{formatUkDate(item.date)}</span>,
    },
    {
      id: 'client',
      header: 'Client',
      sortable: true,
      className: 'min-w-40 max-w-64',
      cell: (item) =>
        item.client ? (
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-semibold text-text" title={item.client.name}>
              {item.client.name}
            </span>
            <span className="truncate text-xs text-text-muted">{item.client.code}</span>
          </div>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: 'job',
      header: 'Job',
      className: 'min-w-40 max-w-64',
      cell: (item) => {
        if (!item.job) return <span className="text-text-muted">—</span>;
        const label = jobText(item.job);
        return canOpenJob ? (
          <Link
            to={routes.org.job(slug, item.job.id)}
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
      hideable: false,
      className: 'min-w-56 max-w-96',
      cell: (item) => {
        const note = fixedFeeNote(item, currency);
        const text = item.description ?? item.supplier;
        return (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <Badge tone={ITEM_KIND_META[item.kind].tone} size="sm">
                {ITEM_KIND_META[item.kind].label}
              </Badge>
              {text ? (
                <span className="truncate text-text" title={text}>
                  {text}
                </span>
              ) : null}
            </span>
            {note ? <span className="truncate text-xs text-text-muted">{note}</span> : null}
          </div>
        );
      },
    },
    {
      id: 'person',
      header: 'Person',
      className: 'whitespace-nowrap',
      cell: (item) => <span className="text-text">{personName(item.person)}</span>,
    },
    {
      id: 'hours',
      header: 'Hours',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (item) =>
        item.hours ? (
          <span className="text-text tabular-nums">{item.hours}</span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: 'rate',
      header: 'Rate',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (item) =>
        item.rate === null ? (
          <span className="text-text-muted">—</span>
        ) : (
          <span className="text-text tabular-nums">{formatMoney(item.rate, currency)}</span>
        ),
    },
    {
      id: 'value',
      header: 'Value',
      align: 'end',
      sortable: true,
      className: 'whitespace-nowrap',
      cell: (item) => (
        <div className="flex flex-col items-end">
          <span className="font-semibold text-text tabular-nums">
            {formatMoney(item.value, currency)}
          </span>
          {item.charge_value !== null &&
          item.charge_value !== undefined &&
          item.charge_value !== item.value ? (
            <span className="text-xs text-text-muted tabular-nums">
              Worth {formatMoney(item.charge_value, currency)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'age',
      header: 'Age',
      className: 'whitespace-nowrap',
      cell: (item) =>
        item.age_days === null || item.age_days === undefined ? (
          <span className="text-text-muted">—</span>
        ) : (
          <Badge tone={ageTone(item.age_days)} size="sm">
            {daysText(item.age_days)}
          </Badge>
        ),
    },
  ];
}
