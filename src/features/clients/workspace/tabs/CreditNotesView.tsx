import { FileMinus2 } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';

import { PageToolbar, SearchField, type DataTableColumn } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useUrlParams } from '@/hooks';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { useClientCreditNotes, type CreditNoteFilters } from '../../api';
import { DateRangeFilter } from '../records/DateRangeFilter';
import { RecordTable } from '../records/RecordTable';
import { isoDateParam, useUrlSearch } from '../records/urlFilters';
import type { CreditNoteRow } from '../types';

export interface CreditNotesViewProps {
  clientId: string;
  clientName: string;
}

/** The client's credit notes (`GET /credit-notes?client_id=`, `invoice.read`). */
export function CreditNotesView({ clientId, clientName }: CreditNotesViewProps) {
  const { organization } = useOrg();
  const { params, setParam } = useUrlParams();
  const { text, setText, searched } = useUrlSearch();
  const from = isoDateParam(params.get('from'));
  const to = isoDateParam(params.get('to'));
  const slug = organization.slug;
  const currency = organization.currency;

  const filters = useMemo<CreditNoteFilters>(
    () => ({ q: searched, from, to }),
    [searched, from, to],
  );
  const query = useClientCreditNotes(clientId, filters);

  const money = (pence: number) => formatMoney(pence, currency);
  const columns: DataTableColumn<CreditNoteRow>[] = [
    {
      id: 'number',
      header: 'Credit note',
      sortable: true,
      sortValue: (note) => note.number,
      cell: (note) => <span className="font-semibold text-text">{note.number}</span>,
    },
    {
      id: 'date',
      header: 'Date',
      sortable: true,
      sortValue: (note) => note.issue_date,
      className: 'whitespace-nowrap',
      cell: (note) => formatUkDate(note.issue_date),
    },
    {
      id: 'invoice',
      header: 'Invoice',
      cell: (note) => (
        <Link
          to={routes.org.invoice(slug, note.invoice_id)}
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

  const filtered = Boolean(searched || from || to);
  return (
    <RecordTable
      caption={`Credit notes of ${clientName}`}
      columns={columns}
      rowKey={(note) => note.id}
      query={query}
      noun={['credit note', 'credit notes']}
      filtered={filtered}
      onClearFilters={() => {
        setText('');
        setParam({ q: null, from: null, to: null });
      }}
      emptyIcon={<FileMinus2 className="size-6" />}
      emptyTitle="No credit notes yet"
      emptyDescription="Credit notes raised against this client's invoices will be listed here."
      errorTitle="Could not load the credit notes"
      toolbar={
        <PageToolbar
          search={
            <SearchField
              label="Search credit notes"
              placeholder="Search by number"
              value={text}
              onChange={setText}
            />
          }
          actions={<DateRangeFilter label="Date" from={from} to={to} />}
        />
      }
    />
  );
}
