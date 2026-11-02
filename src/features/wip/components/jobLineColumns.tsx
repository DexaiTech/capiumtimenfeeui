import { Link } from 'react-router';

import { ClientName, type DataTableColumn } from '@/components/ui';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import type { WipGroupRow } from '../types';
import { jobText } from '../utils/format';

export interface JobLineColumnsOptions {
  currency: string;
  /** Where opening the line goes: the items behind it. */
  itemsHref: (row: WipGroupRow) => string;
  /** Called as a line is opened. */
  onOpen?: (row: WipGroupRow) => void;
}

/** "J00009 VAT returns Q3", or "No job" for the WIP of a client without one. */
const jobLineLabel = (row: WipGroupRow) =>
  row.key ? jobText({ number: row.code, name: row.name }) : 'No job';

/**
 * The columns of WIP Details "By job": one line per job (a row of `GET /wip/summary?group_by=job`)
 * with the job's items merged; the job opens on its items.
 */
export function jobLineColumns({
  currency,
  itemsHref,
  onOpen,
}: JobLineColumnsOptions): DataTableColumn<WipGroupRow>[] {
  return [
    {
      id: 'client',
      header: 'Client',
      className: 'min-w-40 max-w-64',
      cell: (row) =>
        row.client ? (
          <ClientName name={row.client.name} code={row.client.code} />
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: 'name',
      header: 'Job',
      hideable: false,
      sortable: true,
      className: 'min-w-40 max-w-80',
      cell: (row) => {
        const label = jobLineLabel(row);
        return (
          <Link
            to={itemsHref(row)}
            className="block truncate font-semibold text-text hover:text-brand-text"
            title={label}
            aria-label={`${label}${row.client ? `, ${row.client.name}` : ''}: see the items`}
            onClick={() => onOpen?.(row)}
          >
            {label}
          </Link>
        );
      },
    },
    {
      id: 'hours',
      header: 'Hours',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (row) =>
        row.minutes > 0 ? (
          <span className="text-text tabular-nums">{row.hours}</span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: 'items',
      header: 'Items',
      align: 'end',
      sortable: true,
      cell: (row) => <span className="text-text tabular-nums">{row.item_count}</span>,
    },
    {
      id: 'total',
      header: 'Value',
      align: 'end',
      sortable: true,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <span className="font-semibold text-text tabular-nums">
          {formatMoney(row.total, currency)}
        </span>
      ),
    },
    {
      id: 'oldest',
      header: 'Oldest item',
      sortable: true,
      className: 'whitespace-nowrap',
      cell: (row) =>
        row.oldest_date ? (
          <span className="text-text">{formatUkDate(row.oldest_date)}</span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
  ];
}
