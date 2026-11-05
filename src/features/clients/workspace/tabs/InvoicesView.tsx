import { MoneyTone } from '@/components/ui/MoneyTone';
import { FilePlus2, FileText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import {
  Button,
  ConfirmDialog,
  PageToolbar,
  RowActions,
  SearchField,
  Select,
  useToast,
  type DataTableColumn,
} from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { PrepareInvoicePanel } from '@/features/billing';
import { useOrg } from '@/features/organizations';
import { useUrlParams } from '@/hooks';
import { cn } from '@/utils/cn';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { useClientInvoices, useDeleteDraftInvoice, type InvoiceFilters } from '../../api';
import { ToneBadge } from '../badges';
import { INVOICE_STATUS_LABELS } from '../constants';
import { describeError, type Failure } from '../errors';
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

/**
 * The client's invoices (`GET /invoices?client_id=`, `invoice.read`): status, issue dates, number.
 * With `invoice.create`, as in Billing: "New invoice" opens the invoice preparation for this client
 * here, above the list, and the person stays on the client once it is made (APT61); a draft is
 * edited on its own page or deleted here. Issued invoices are locked: they are corrected (credit
 * note, void) from the invoice's page.
 */
export function InvoicesView({ clientId, clientName }: InvoicesViewProps) {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const navigate = useNavigate();
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
  const remove = useDeleteDraftInvoice();
  const [deleting, setDeleting] = useState<InvoiceRow | null>(null);
  const [refusal, setRefusal] = useState<Failure | null>(null);
  const [creating, setCreating] = useState(false);
  const canChange = can(P.invoiceCreate);

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast({
          tone: 'success',
          title: 'Draft deleted',
          description: 'Its work is unbilled WIP again.',
        });
        setDeleting(null);
      },
      onError: (error) => setRefusal(describeError(error)),
    });
  };

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
      cell: (invoice) => (
        <MoneyTone kind="in" value={invoice.paid_total}>
          {money(invoice.paid_total)}
        </MoneyTone>
      ),
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
    <>
      {creating ? (
        // Like "Add expense": the invoice is made here, and the person stays on the client.
        <PrepareInvoicePanel
          clientId={clientId}
          onClose={() => setCreating(false)}
          onCreated={() => setCreating(false)}
        />
      ) : null}
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
        rowActions={
          canChange
            ? (invoice) => (
                <RowActions
                  label={`Actions for ${invoice.number ?? 'Draft'}`}
                  items={
                    // Only a draft can change; an issued invoice keeps its link to its own page.
                    invoice.display_status === 'draft'
                      ? [
                          {
                            id: 'edit',
                            label: 'Edit draft',
                            onSelect: () => void navigate(routes.org.invoice(slug, invoice.id)),
                          },
                          {
                            id: 'delete',
                            label: 'Delete draft',
                            tone: 'danger',
                            onSelect: () => {
                              setRefusal(null);
                              setDeleting(invoice);
                            },
                          },
                        ]
                      : []
                  }
                />
              )
            : undefined
        }
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
            primaryAction={
              canChange ? (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<FilePlus2 aria-hidden="true" className="size-4" />}
                  onClick={() => setCreating(true)}
                  disabled={creating}
                >
                  New invoice
                </Button>
              ) : undefined
            }
          />
        }
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete draft?"
        confirmLabel="Delete draft"
        loading={remove.isPending}
        error={refusal}
      >
        <p>
          The draft for <strong className="font-medium text-text">{clientName}</strong> will be
          removed and the work on it goes back to unbilled WIP.
        </p>
      </ConfirmDialog>
    </>
  );
}
