import { Link } from 'react-router';

import type { DataTableColumn } from '@/components/ui';
import { routes } from '@/constants/routes';
import { formatMoney } from '@/utils/money';

import type { CreditNote } from '../../types';
import { dateCell } from '../../utils/format';

/** The columns of the credit-note list. */
export function creditNoteColumns(slug: string, currency: string): DataTableColumn<CreditNote>[] {
  const money = (pence: number) => formatMoney(pence, currency);
  return [
    {
      id: 'number',
      header: 'Credit note',
      sortable: true,
      hideable: false,
      sortValue: (note) => note.number,
      className: 'whitespace-nowrap',
      cell: (note) => <span className="font-semibold text-text">{note.number}</span>,
    },
    {
      id: 'date',
      header: 'Date',
      sortable: true,
      sortValue: (note) => note.issue_date,
      className: 'whitespace-nowrap',
      cell: (note) => dateCell(note.issue_date),
    },
    {
      id: 'client',
      header: 'Client',
      sortable: true,
      sortValue: (note) => note.client?.name ?? '',
      cell: (note) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-text">{note.client?.name ?? '—'}</span>
          {note.client ? <span className="text-xs text-text-muted">{note.client.code}</span> : null}
        </div>
      ),
    },
    {
      id: 'invoice',
      header: 'Invoice',
      sortable: true,
      sortValue: (note) => note.invoice_number ?? '',
      className: 'whitespace-nowrap',
      cell: (note) => (
        <Link
          to={routes.org.invoice(slug, note.invoice_id)}
          onClick={(event) => event.stopPropagation()}
          className="font-semibold text-brand-text hover:underline"
        >
          {note.invoice_number ?? 'Invoice'}
        </Link>
      ),
    },
    {
      id: 'reason',
      header: 'Reason',
      cell: (note) => (
        <span className="block max-w-64 truncate" title={note.reason}>
          {note.reason}
        </span>
      ),
    },
    {
      id: 'net',
      header: 'Net',
      align: 'end',
      className: 'tabular-nums',
      cell: (note) => money(note.net_total),
    },
    {
      id: 'vat',
      header: 'VAT',
      align: 'end',
      className: 'tabular-nums',
      cell: (note) => money(note.vat_total),
    },
    {
      id: 'total',
      header: 'Total',
      align: 'end',
      sortable: true,
      sortValue: (note) => note.gross_total,
      className: 'font-semibold tabular-nums',
      cell: (note) => money(note.gross_total),
    },
  ];
}
