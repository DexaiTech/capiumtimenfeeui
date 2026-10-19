import { FileText } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';

import { PageToolbar, SearchField, Select, type DataTableColumn } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useUrlParams } from '@/hooks';
import { cn } from '@/utils/cn';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { useClientInvoices, type InvoiceFilters } from '../../api';
import { ToneBadge } from '../badges';
import { INVOICE_STATUS_LABELS } from '../constants';
import { DateRangeFilter } from '../records/DateRangeFilter';
import { RecordTable } from '../records/RecordTable';
import { isoDateParam, oneOf, useUrlSearch } from '../records/urlFilters';
import { INVOICE_STATUSES, type InvoiceRow } from '../types';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...INVOICE_STATUSES.map((status) => ({
    value: status,
    label: INVOICE_STATUS_LABELS[status].label,
  })),
];

export interface InvoicesViewProps {
  clientId: string;
  clientName: string;
}

/** The client's invoices (`GET /invoices?client_id=`, `invoice.read`): status, issue dates, number. */
export function InvoicesView({ clientId, clientName }: InvoicesViewProps) {
  const { organization } = useOrg();
  const { params, setParam } = useUrlParams();
  const { text, setText, searched } = useUrlSearch();
  const status = oneOf(params.get('status'), INVOICE_STATUSES);
  const from = isoDateParam(params.get('from'));
  const to = isoDateParam(params.get('to'));
  const slug = organization.slug;
  const currency = organization.currency;

  const filters = useMemo<InvoiceFilters>(
    () => ({ q: searched, status, from, to }),
    [searched, status, from, to],
  );
  const query = useClientInvoices(clientId, filters);

  const money = (pence: number) => formatMoney(pence, currency);
  const columns: DataTableColumn<InvoiceRow>[] = [
    {
      id: 'number',
      header: 'Invoice',
      sortable: true,
      sortValue: (invoice) => invoice.number ?? '',
      cell: (invoice) => (
        <Link
          to={routes.org.invoice(slug, invoice.id)}
          className="font-semibold text-brand-text hover:underline"
        >
          {invoice.number ?? 'Draft'}
        </Link>
      ),
    },
    {
      id: 'issued',
      header: 'Issued',
      sortable: true,
      sortValue: (invoice) => invoice.issue_date,
      className: 'whitespace-nowrap',
      cell: (invoice) => formatUkDate(invoice.issue_date) || '—',
    },
    {
      id: 'due',
      header: 'Due',
      sortable: true,
      sortValue: (invoice) => invoice.due_date,
      className: 'whitespace-nowrap',
      cell: (invoice) => formatUkDate(invoice.due_date) || '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (invoice) => <ToneBadge info={INVOICE_STATUS_LABELS[invoice.display_status]} />,
    },
    { id: 'reference', header: 'Reference', cell: (invoice) => invoice.reference ?? '—' },
    {
      id: 'total',
      header: 'Total',
      align: 'end',
      sortable: true,
      sortValue: (invoice) => invoice.gross_total,
      className: 'tabular-nums',
      cell: (invoice) => money(invoice.gross_total),
    },
    {
      id: 'paid',
      header: 'Paid',
      align: 'end',
      className: 'tabular-nums',
      cell: (invoice) => money(invoice.paid_total),
    },
    {
      id: 'balance',
      header: 'Balance',
      align: 'end',
      sortable: true,
      sortValue: (invoice) => invoice.balance,
      className: 'tabular-nums',
      cell: (invoice) => (
        <span
          className={cn(
            'font-semibold',
            invoice.display_status === 'overdue' ? 'text-danger' : 'text-text',
          )}
        >
          {money(invoice.balance)}
        </span>
      ),
    },
  ];

  const filtered = Boolean(searched || status || from || to);
  return (
    <RecordTable
      caption={`Invoices of ${clientName}`}
      columns={columns}
      rowKey={(invoice) => invoice.id}
      query={query}
      noun={['invoice', 'invoices']}
      filtered={filtered}
      onClearFilters={() => {
        setText('');
        setParam({ q: null, status: null, from: null, to: null });
      }}
      emptyIcon={<FileText className="size-6" />}
      emptyTitle="No invoices yet"
      emptyDescription="Invoices raised for this client will be listed here."
      errorTitle="Could not load the invoices"
      toolbar={
        <PageToolbar
          search={
            <SearchField
              label="Search invoices"
              placeholder="Search by number"
              value={text}
              onChange={setText}
            />
          }
          actions={
            <>
              <Select
                label="Status"
                hideLabel
                options={STATUS_OPTIONS}
                value={status}
                onChange={(event) => setParam({ status: event.target.value })}
                className="w-full sm:w-40"
              />
              <DateRangeFilter label="Issue date" from={from} to={to} />
            </>
          }
        />
      }
    />
  );
}
