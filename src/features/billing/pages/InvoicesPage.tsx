import { Download, Ellipsis, FilePlus2, FileText, Mail, SearchX, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import {
  Button,
  ColumnVisibilityMenu,
  ConfirmDialog,
  CountTabs,
  DataTable,
  Dropdown,
  EmptyState,
  PageToolbar,
  Pagination,
  SearchField,
  buttonClasses,
  sortRows,
  useBulkFlow,
  useToast,
  type DataTableSort,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, usePersistentColumns, useUrlParams } from '@/hooks';
import { MAX_BULK_IDS } from '@/utils/bulk';
import { todayInZone } from '@/utils/dates';

import {
  billingApi,
  fetchEverything,
  flattenPages,
  useBulkInvoices,
  useDeleteInvoice,
  useInvoiceList,
  useInvoiceSummary,
  useIssueInvoice,
  useSendInvoice,
  useSubmitInvoice,
} from '../api';
import { FilterPopover } from '../components/FilterPopover';
import { InvoiceFilterFields } from '../components/invoices/InvoiceFilterFields';
import { invoiceColumns } from '../components/invoices/invoiceColumns';
import { InvoiceSummaryCards } from '../components/invoices/InvoiceSummaryCards';
import { IssueDialog } from '../components/IssueDialog';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { ReasonDialog } from '../components/ReasonDialog';
import { SendInvoiceDialog } from '../components/SendInvoiceDialog';
import { EXPORT_ROW_LIMIT, INVOICE_STATUS_LABELS, INVOICE_TAB_ORDER } from '../constants';
import { useFileDownload } from '../hooks/useFileDownload';
import { isoDateParam, useUrlSearch } from '../hooks/useUrlSearch';
import type {
  InvoiceBulkRequest,
  InvoiceDisplayStatus,
  InvoiceListFilters,
  InvoiceSummary,
} from '../types';
import { bulkNotice, runEach } from '../utils/bulk';
import { dialogError, describeFailure } from '../utils/errors';
import { exportInvoicesCsv } from '../utils/exportInvoices';
import { clientLabel, invoiceLabel, plural } from '../utils/format';

type InvoiceTab = 'all' | InvoiceDisplayStatus;

const TABS: ReadonlyArray<{ value: InvoiceTab; label: string }> = [
  { value: 'all', label: 'All' },
  ...INVOICE_TAB_ORDER.map((status) => ({
    value: status,
    label: INVOICE_STATUS_LABELS[status].label,
  })),
];

type DialogState =
  | { type: 'issue'; invoice: InvoiceSummary }
  | { type: 'submit'; invoice: InvoiceSummary }
  | { type: 'send'; invoice: InvoiceSummary }
  | { type: 'delete'; invoice: InvoiceSummary }
  | { type: 'bulk-issue' }
  | { type: 'bulk-submit' }
  | { type: 'bulk-send' }
  | { type: 'bulk-delete' }
  | null;

function InvoiceList() {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();
  const { busy, download } = useFileDownload();
  const slug = organization.slug;
  const today = todayInZone(organization.timezone);

  const tabParam = params.get('tab');
  const tab: InvoiceTab = TABS.find((item) => item.value === tabParam)?.value ?? 'all';
  const clientId = params.get('client') ?? '';
  const from = isoDateParam(params.get('from'));
  const to = isoDateParam(params.get('to'));

  const filters = useMemo<InvoiceListFilters>(
    () => ({
      client_id: clientId || undefined,
      status: tab === 'all' ? undefined : [tab],
      date_from: from || undefined,
      date_to: to || undefined,
      q: searched || undefined,
    }),
    [clientId, tab, from, to, searched],
  );
  const invoices = useInvoiceList(filters);
  const summary = useInvoiceSummary(filters);
  const issue = useIssueInvoice();
  const submit = useSubmitInvoice();
  const send = useSendInvoice();
  const remove = useDeleteInvoice();
  const bulkDelete = useBulkInvoices();

  const [hidden, setHidden] = usePersistentColumns('invoices');
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const close = () => setDialog(null);
  const deletion = useBulkFlow({
    run: (body: InvoiceBulkRequest) => bulkDelete.mutateAsync(body),
    noun: ['draft', 'drafts'],
    onDone: () => {
      setSelected(new Set());
      setDialog(null);
    },
  });

  const columns = useMemo(
    () => invoiceColumns({ slug, currency: organization.currency, today }),
    [slug, organization.currency, today],
  );
  const sortParam = params.get('sort');
  const orderParam = params.get('order');
  const sort = useMemo<DataTableSort | null>(
    () =>
      columns.some((column) => column.id === sortParam && column.sortable)
        ? { columnId: sortParam ?? '', direction: orderParam === 'desc' ? 'desc' : 'asc' }
        : null,
    [columns, sortParam, orderParam],
  );
  const loaded = useMemo(() => flattenPages(invoices.data), [invoices.data]);
  const rows = useMemo(() => sortRows(loaded, columns, sort), [loaded, columns, sort]);

  const chosen = rows.filter((row) => selected.has(row.id));
  const drafts = chosen.filter((row) => row.status === 'draft');
  const issuable = drafts.filter((row) => !row.approval_required);
  const submittable = drafts.filter((row) => row.approval_required);
  const sendable = chosen.filter((row) => row.status === 'issued' && row.number !== null);
  const canIssue = can(P.invoiceIssue);
  const canDelete = can(P.invoiceCreate);
  const canSubmit = can(P.invoiceCreate);

  const openPdf = (invoice: InvoiceSummary) =>
    void download(invoice.id, `${invoice.number ?? 'draft-invoice'}.pdf`, () =>
      billingApi.invoicePdf(organization.id, invoice.id),
    );

  const actionsFor = (invoice: InvoiceSummary): DropdownItem[] => {
    const items: DropdownItem[] = [
      {
        id: 'open',
        label: 'Open',
        onSelect: () => void navigate(routes.org.invoice(slug, invoice.id)),
      },
      { id: 'pdf', label: 'Download PDF', onSelect: () => openPdf(invoice) },
    ];
    if (invoice.status === 'draft' && canIssue && !invoice.approval_required) {
      items.push({
        id: 'issue',
        label: 'Issue…',
        onSelect: () => setDialog({ type: 'issue', invoice }),
      });
    }
    if (invoice.status === 'draft' && canSubmit && invoice.approval_required) {
      items.push({
        id: 'submit',
        label: 'Submit for approval…',
        onSelect: () => setDialog({ type: 'submit', invoice }),
      });
    }
    if (invoice.status === 'approved' && canIssue) {
      items.push({
        id: 'issue',
        label: 'Issue…',
        onSelect: () => setDialog({ type: 'issue', invoice }),
      });
    }
    if (invoice.status === 'issued' && canIssue) {
      items.push({
        id: 'send',
        label: 'Send email…',
        onSelect: () => setDialog({ type: 'send', invoice }),
      });
    }
    // An issued invoice is locked, not deletable: it is corrected with a credit note, or, when
    // nothing was paid or credited against it, voided. Both open on the invoice's own page.
    const correct = (action: 'payment' | 'credit' | 'void') =>
      void navigate(`${routes.org.invoice(slug, invoice.id)}?action=${action}`);
    if (invoice.status === 'issued' && invoice.balance > 0 && can(P.paymentRecord)) {
      items.push({
        id: 'payment',
        label: 'Record payment…',
        onSelect: () => correct('payment'),
      });
    }
    if (invoice.status === 'issued' && invoice.balance > 0 && can(P.creditNoteCreate)) {
      items.push({
        id: 'credit',
        label: 'Raise credit note…',
        onSelect: () => correct('credit'),
      });
    }
    if (
      invoice.status === 'issued' &&
      canIssue &&
      invoice.paid_total === 0 &&
      invoice.credited_total === 0
    ) {
      items.push({
        id: 'void',
        label: 'Void invoice…',
        tone: 'danger',
        onSelect: () => correct('void'),
      });
    }
    if (invoice.status === 'draft' && can(P.invoiceCreate)) {
      items.push(
        { id: 'separator', separator: true },
        {
          id: 'delete',
          label: 'Delete draft',
          tone: 'danger',
          onSelect: () => {
            setRefusal(null);
            setDialog({ type: 'delete', invoice });
          },
        },
      );
    }
    return items;
  };

  const confirmDelete = () => {
    if (dialog?.type !== 'delete') return;
    remove.mutate(dialog.invoice.id, {
      onSuccess: () => {
        toast({
          tone: 'success',
          title: 'Draft deleted',
          description: 'Its work is unbilled WIP again.',
        });
        close();
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  const runBulk = async (kind: 'issue' | 'submit' | 'send') => {
    setBulkBusy(true);
    const draftLabel = (row: InvoiceSummary) => `Draft for ${row.client?.name ?? 'a client'}`;
    const result =
      kind === 'issue'
        ? await runEach(issuable, (row) => issue.mutateAsync({ invoiceId: row.id }), draftLabel)
        : kind === 'submit'
          ? await runEach(
              submittable,
              (row) => submit.mutateAsync({ invoiceId: row.id }),
              draftLabel,
            )
          : await runEach(
              sendable,
              (row) => send.mutateAsync({ invoiceId: row.id }),
              (row) => invoiceLabel(row),
            );
    setBulkBusy(false);
    toast(
      bulkNotice(
        kind === 'issue'
          ? 'issued'
          : kind === 'submit'
            ? 'sent for approval'
            : 'queued for emailing',
        ['invoice', 'invoices'],
        result,
      ),
    );
    setSelected(new Set());
    close();
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const { rows: all, truncated } = await fetchEverything(
        (cursor) => billingApi.listInvoices(organization.id, filters, { cursor, limit: 100 }),
        EXPORT_ROW_LIMIT,
      );
      exportInvoicesCsv(all, organization.currency);
      toast({
        tone: truncated ? 'warning' : 'success',
        title: `${plural(all.length, 'invoice', 'invoices')} exported`,
        description: truncated
          ? `The file holds the first ${EXPORT_ROW_LIMIT} rows: narrow the filters.`
          : undefined,
      });
    } catch (error) {
      toast({ tone: 'error', ...describeFailure(error, 'Could not export the invoices') });
    } finally {
      setExporting(false);
    }
  };

  const filterCount = (clientId ? 1 : 0) + (from || to ? 1 : 0);
  const filtered = Boolean(searched) || tab !== 'all' || filterCount > 0;
  const counts = summary.data?.counts;
  const tabCount = (value: InvoiceTab): number | undefined =>
    counts
      ? counts[value === 'all' ? 'total' : value]
      : value === tab && invoices.data && !invoices.hasNextPage
        ? loaded.length
        : undefined;

  if (invoices.isError && !invoices.data) {
    return (
      <LoadError
        title="Could not load the invoices"
        error={invoices.error}
        onRetry={() => void invoices.refetch()}
        retrying={invoices.isRefetching}
      />
    );
  }

  const clearFilters = () => {
    setSearchText('');
    setParam({ q: null, tab: null, client: null, from: null, to: null });
  };
  const target = dialog && 'invoice' in dialog ? dialog.invoice : null;
  const prepareLink = routes.org.module(slug, 'billing', 'prepare');

  return (
    <>
      <InvoiceSummaryCards summary={summary.data} currency={organization.currency} />
      <DataTable
        caption="Invoices"
        columns={columns}
        rows={rows}
        rowKey={(invoice) => invoice.id}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        selectLabel={(invoice) => `Select ${invoiceLabel(invoice)}`}
        sort={sort}
        onSortChange={(next) => setParam({ sort: next.columnId, order: next.direction })}
        hiddenColumns={hidden}
        onRowClick={(invoice) => void navigate(routes.org.invoice(slug, invoice.id))}
        loading={invoices.isPending}
        toolbar={
          <PageToolbar
            start={
              <CountTabs
                label="Invoice statuses"
                items={TABS.map((item) => ({ ...item, count: tabCount(item.value) }))}
                value={tab}
                onChange={(value) => setParam({ tab: value === 'all' ? null : value })}
              />
            }
            search={
              <SearchField
                label="Search invoices"
                placeholder="Search number or client"
                value={searchText}
                onChange={setSearchText}
              />
            }
            actions={
              <>
                {chosen.length > 0 ? (
                  <div
                    className="flex flex-wrap items-center gap-2"
                    role="group"
                    aria-label="Selected invoices"
                  >
                    <span aria-live="polite" className="text-xs font-medium text-text-muted">
                      {chosen.length} selected
                    </span>
                    {canIssue && issuable.length > 0 ? (
                      <Button
                        size="sm"
                        variant="brand-outline"
                        onClick={() => setDialog({ type: 'bulk-issue' })}
                      >
                        Issue {issuable.length}
                      </Button>
                    ) : null}
                    {canSubmit && submittable.length > 0 ? (
                      <Button
                        size="sm"
                        variant="brand-outline"
                        onClick={() => setDialog({ type: 'bulk-submit' })}
                      >
                        Submit {submittable.length} for approval
                      </Button>
                    ) : null}
                    {canIssue && sendable.length > 0 ? (
                      <Button
                        size="sm"
                        variant="brand-outline"
                        leftIcon={<Mail aria-hidden="true" className="size-4" />}
                        onClick={() => setDialog({ type: 'bulk-send' })}
                      >
                        Email {sendable.length}
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={chosen.length > MAX_BULK_IDS}
                        leftIcon={<Trash2 aria-hidden="true" className="size-4" />}
                        onClick={() => {
                          deletion.clearRefusal();
                          setDialog({ type: 'bulk-delete' });
                        }}
                      >
                        Delete {chosen.length}
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                      Clear selection
                    </Button>
                    <span role="status" className="sr-only">
                      {deletion.announcement}
                    </span>
                  </div>
                ) : null}
                <FilterPopover
                  title="Filter invoices"
                  count={filterCount}
                  onClear={() => setParam({ client: null, from: null, to: null })}
                >
                  <InvoiceFilterFields
                    clientId={clientId}
                    from={from}
                    to={to}
                    canPickClient={can(P.clientRead)}
                    onChange={(changes) =>
                      setParam({
                        ...(changes.client !== undefined ? { client: changes.client } : {}),
                        ...(changes.from !== undefined ? { from: changes.from } : {}),
                        ...(changes.to !== undefined ? { to: changes.to } : {}),
                      })
                    }
                  />
                </FilterPopover>
                <ColumnVisibilityMenu
                  columns={columns.map((column) => ({
                    id: column.id,
                    label: column.header,
                    locked: column.hideable === false,
                  }))}
                  hidden={hidden}
                  onChange={setHidden}
                />
                <Button
                  size="sm"
                  variant="brand-outline"
                  loading={exporting}
                  leftIcon={<Download aria-hidden="true" className="size-4" />}
                  onClick={() => void exportAll()}
                >
                  Export CSV
                </Button>
              </>
            }
            primaryAction={
              can(P.invoiceCreate) ? (
                <Link
                  to={prepareLink}
                  className={buttonClasses({ variant: 'primary', size: 'sm' })}
                >
                  <FilePlus2 aria-hidden="true" className="size-4" />
                  Create invoice
                </Link>
              ) : undefined
            }
          />
        }
        rowActions={(invoice) => (
          <Dropdown
            label={`Actions for ${invoiceLabel(invoice)} of ${invoice.client?.name ?? 'client'}`}
            items={actionsFor(invoice)}
            trigger={
              busy === invoice.id ? (
                <span className="text-xs text-text-muted">Downloading…</span>
              ) : (
                <Ellipsis aria-hidden="true" className="size-5 text-text-muted" />
              )
            }
          />
        )}
        empty={
          filtered ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="No invoices match"
              description="Try a different search, status or date range."
              action={<Button onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={<FileText className="size-6" />}
              title="No invoices yet"
              description="Invoices prepared from work in progress are listed here."
              action={
                can(P.invoiceCreate) ? (
                  <Link to={prepareLink} className={buttonClasses({ variant: 'primary' })}>
                    Create invoice
                  </Link>
                ) : undefined
              }
            />
          )
        }
        footer={
          rows.length > 0 ? (
            <div className="border-t border-row-border px-4 py-2">
              <Pagination
                hasMore={invoices.hasNextPage}
                onLoadMore={() => void invoices.fetchNextPage()}
                loading={invoices.isFetchingNextPage}
                count={rows.length}
                itemLabel={['invoice', 'invoices']}
              />
            </div>
          ) : null
        }
      />
      {dialog?.type === 'issue' ? (
        <IssueDialog open invoice={dialog.invoice} onClose={close} />
      ) : null}
      {dialog?.type === 'send' ? (
        <SendInvoiceDialog open invoice={dialog.invoice} onClose={close} />
      ) : null}
      {dialog?.type === 'submit' ? (
        <ReasonDialog
          open
          onClose={close}
          title="Submit for approval?"
          description={`The draft for ${clientLabel(dialog.invoice.client)} is locked until it is approved or rejected.`}
          label="Message for the approvers (optional)"
          required={false}
          tone="primary"
          confirmLabel="Submit for approval"
          onSubmit={async (note) => {
            await submit.mutateAsync({ invoiceId: dialog.invoice.id, note: note || undefined });
            toast({ tone: 'success', title: 'Sent for approval' });
          }}
        />
      ) : null}
      <ConfirmDialog
        open={dialog?.type === 'delete'}
        onClose={close}
        onConfirm={confirmDelete}
        title="Delete draft?"
        confirmLabel="Delete draft"
        loading={remove.isPending}
        error={refusal}
      >
        <p>
          The draft for{' '}
          <strong className="font-medium text-text">{clientLabel(target?.client)}</strong> will be
          removed and the work on it goes back to unbilled WIP.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog?.type === 'bulk-delete'}
        onClose={close}
        onConfirm={() =>
          void deletion.submit(
            { invoice_ids: chosen.map((row) => row.id), action: 'delete' },
            'deleted',
          )
        }
        title={`Delete ${plural(chosen.length, 'draft', 'drafts')}?`}
        confirmLabel={`Delete ${chosen.length}`}
        loading={deletion.busy}
        error={deletion.refusal}
      >
        <p>
          The {plural(chosen.length, 'selected invoice', 'selected invoices')} will be removed and
          the work on {chosen.length === 1 ? 'it' : 'them'} goes back to unbilled WIP. Only drafts
          can be deleted: issued, paid and void invoices are locked and are corrected with a credit
          note.
        </p>
        {chosen.length > drafts.length ? (
          <p className="font-medium text-text">
            {plural(chosen.length - drafts.length, 'selected invoice is', 'selected invoices are')}{' '}
            not a draft. Untick {chosen.length - drafts.length === 1 ? 'it' : 'them'} first: if any
            is included, none is deleted.
          </p>
        ) : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog?.type === 'bulk-issue'}
        onClose={close}
        onConfirm={() => void runBulk('issue')}
        title={`Issue ${plural(issuable.length, 'invoice', 'invoices')}?`}
        confirmLabel={`Issue ${issuable.length}`}
        tone="default"
        loading={bulkBusy}
      >
        <p>
          Each draft gets the next invoice number, its work is billed and it can no longer be
          edited. Drafts that need approval are left out.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog?.type === 'bulk-submit'}
        onClose={close}
        onConfirm={() => void runBulk('submit')}
        title={`Submit ${plural(submittable.length, 'invoice', 'invoices')} for approval?`}
        confirmLabel={`Submit ${submittable.length}`}
        tone="default"
        loading={bulkBusy}
      >
        <p>
          Each draft is locked until an approver approves or rejects it. The approvers are told.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog?.type === 'bulk-send'}
        onClose={close}
        onConfirm={() => void runBulk('send')}
        title={`Email ${plural(sendable.length, 'invoice', 'invoices')}?`}
        confirmLabel={`Email ${sendable.length}`}
        tone="default"
        loading={bulkBusy}
      >
        <p>
          Each invoice is emailed as a PDF to its client's invoice email, or else its billing
          contacts.
        </p>
      </ConfirmDialog>
    </>
  );
}

/** `/:orgSlug/billing/invoices`: every invoice of the practice (`invoice.read`). */
export default function InvoicesPage() {
  const { can } = useOrg();
  useDocumentTitle('Invoices');
  return (
    <PageShell
      title="Invoices"
      description="Draft, approve, issue, send and chase invoices. Issued invoices are locked: correct them with a credit note."
    >
      {can(P.invoiceRead) ? <InvoiceList /> : <NoAccess what="invoices" />}
    </PageShell>
  );
}
