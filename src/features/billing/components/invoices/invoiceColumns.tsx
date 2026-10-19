import { Link } from 'react-router';

import type { DataTableColumn } from '@/components/ui';
import { routes } from '@/constants/routes';
import { cn } from '@/utils/cn';
import { formatMoney } from '@/utils/money';

import type { InvoiceDisplayStatus, InvoiceSummary } from '../../types';
import { dateCell, daysOverdue, invoiceLabel, plural } from '../../utils/format';
import { InvoiceStatusBadge } from '../badges';

/** Statuses whose invoice has been issued, so an outstanding amount means something. */
const ISSUED: ReadonlySet<InvoiceDisplayStatus> = new Set([
  'issued',
  'part_paid',
  'overdue',
  'paid',
  'credited',
]);

export interface InvoiceColumnOptions {
  slug: string;
  currency: string;
  /** Today in the practice time zone, `YYYY-MM-DD`. */
  today: string;
}

/** The columns of the invoice list: number, client, dates, amounts, outstanding and status. */
export function invoiceColumns({
  slug,
  currency,
  today,
}: InvoiceColumnOptions): DataTableColumn<InvoiceSummary>[] {
  const money = (pence: number) => formatMoney(pence, currency);
  return [
    {
      id: 'number',
      header: 'Invoice',
      sortable: true,
      hideable: false,
      sortValue: (invoice) => invoice.number ?? '',
      className: 'whitespace-nowrap',
      cell: (invoice) => (
        <Link
          to={routes.org.invoice(slug, invoice.id)}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            'font-semibold hover:underline',
            invoice.number ? 'text-brand-text' : 'text-text-muted italic',
          )}
        >
          {invoiceLabel(invoice)}
        </Link>
      ),
    },
    {
      id: 'client',
      header: 'Client',
      sortable: true,
      sortValue: (invoice) => invoice.client?.name ?? '',
      cell: (invoice) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-text">{invoice.client?.name ?? '—'}</span>
          {invoice.client ? (
            <span className="text-xs text-text-muted">{invoice.client.code}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      sortable: true,
      sortValue: (invoice) => invoice.issue_date ?? '',
      className: 'whitespace-nowrap',
      cell: (invoice) => dateCell(invoice.issue_date),
    },
    {
      id: 'due',
      header: 'Due',
      sortable: true,
      sortValue: (invoice) => invoice.due_date ?? '',
      className: 'whitespace-nowrap',
      cell: (invoice) => {
        const late = invoice.display_status === 'overdue' ? daysOverdue(invoice.due_date, today) : 0;
        return (
          <div className="flex flex-col">
            <span>{dateCell(invoice.due_date)}</span>
            {late > 0 ? (
              <span className="text-xs text-danger">{plural(late, 'day', 'days')} overdue</span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'net',
      header: 'Net',
      align: 'end',
      sortable: true,
      sortValue: (invoice) => invoice.net_total,
      className: 'tabular-nums',
      cell: (invoice) => money(invoice.net_total),
    },
    {
      id: 'vat',
      header: 'VAT',
      align: 'end',
      sortable: true,
      sortValue: (invoice) => invoice.vat_total,
      className: 'tabular-nums',
      cell: (invoice) => money(invoice.vat_total),
    },
    {
      id: 'gross',
      header: 'Gross',
      align: 'end',
      sortable: true,
      sortValue: (invoice) => invoice.gross_total,
      className: 'font-semibold tabular-nums',
      cell: (invoice) => money(invoice.gross_total),
    },
    {
      id: 'balance',
      header: 'Outstanding',
      align: 'end',
      sortable: true,
      sortValue: (invoice) => (ISSUED.has(invoice.display_status) ? invoice.balance : null),
      className: 'tabular-nums',
      cell: (invoice) =>
        ISSUED.has(invoice.display_status) ? (
          <span
            className={cn(
              'font-semibold',
              invoice.display_status === 'overdue' ? 'text-danger' : 'text-text',
            )}
          >
            {money(invoice.balance)}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (invoice) => invoice.display_status,
      cell: (invoice) => <InvoiceStatusBadge status={invoice.display_status} />,
    },
  ];
}
