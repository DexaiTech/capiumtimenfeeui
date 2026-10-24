import { Ellipsis, HandCoins, Pencil, Plus, SearchX, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import {
  Badge,
  Button,
  ConfirmDialog,
  CountTabs,
  DataTable,
  DateRangeField,
  Dropdown,
  EmptyState,
  PageToolbar,
  Pagination,
  Select,
  useToast,
  type DataTableColumn,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useAuth } from '@/features/auth';
import { useOrg } from '@/features/organizations';
import { ClientPicker, useVatCodes } from '@/features/team';
import { useDocumentTitle, useUrlParams } from '@/hooks';
import { formatUkDate } from '@/utils/dates';
import { formatBasisPoints, formatMoney } from '@/utils/money';

import {
  flattenPages,
  useClientName,
  useDeleteDisbursement,
  useDisbursementList,
  useJobName,
} from '../api';
import { DisbursementFormPanel } from '../components/DisbursementFormPanel';
import { FilterPopover } from '../components/FilterPopover';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { BillingBadge } from '../components/StatusBadge';
import { BILLING_STATUS_META } from '../constants';
import { BILLING_STATUSES, type BillingStatus, type Disbursement } from '../types';
import { dialogError } from '../utils/errors';

type Tab = 'all' | BillingStatus;

const TABS: ReadonlyArray<{ value: Tab; label: string }> = [
  { value: 'all', label: 'All' },
  ...BILLING_STATUSES.map((status) => ({
    value: status,
    label: BILLING_STATUS_META[status].label,
  })),
];

const BILLABLE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'true', label: 'Billable' },
  { value: 'false', label: 'Not billable' },
];

const isoDate = (value: string | null) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

function ClientCell({ clientId }: { clientId: string }) {
  const { organization, can } = useOrg();
  const client = useClientName(clientId);
  if (!can(PERMISSIONS.clientRead)) return <span className="text-text-muted">—</span>;
  return client.data ? (
    <Link
      to={routes.org.client(organization.slug, client.data.id)}
      className="block truncate font-medium text-text hover:text-brand-text hover:underline"
      title={client.data.name}
    >
      {client.data.name}
    </Link>
  ) : (
    <span className="text-text-muted">{client.isError ? 'Client' : '…'}</span>
  );
}

function JobCell({ jobId }: { jobId: string | null }) {
  const { organization, can } = useOrg();
  const job = useJobName(jobId);
  if (!jobId) return <span className="text-text-muted">No job</span>;
  if (!can(PERMISSIONS.jobRead)) return <span className="text-text-muted">—</span>;
  return job.data ? (
    <Link
      to={routes.org.job(organization.slug, job.data.id)}
      className="block truncate text-text hover:text-brand-text hover:underline"
      title={job.data.name}
    >
      {job.data.number} · {job.data.name}
    </Link>
  ) : (
    <span className="text-text-muted">{job.isError ? 'Job' : '…'}</span>
  );
}

type DialogState =
  | { type: 'form'; disbursement: Disbursement | null }
  | { type: 'delete'; disbursement: Disbursement }
  | null;

/**
 * `/:orgSlug/expenses/disbursements`: costs paid on a client's behalf, to recharge them. A person
 * with `wip.read` sees all of them, otherwise only their own; each is changed or deleted while it
 * is unbilled, by the person who recorded it or by `disbursement.manage`.
 */
export default function DisbursementsPage() {
  useDocumentTitle('Disbursements');
  const { organization, can } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const currency = organization.currency;
  const vatCodes = useVatCodes();

  const canRead =
    can(PERMISSIONS.wipRead) ||
    can(PERMISSIONS.disbursementLog) ||
    can(PERMISSIONS.disbursementManage);
  const canRecord =
    (can(PERMISSIONS.disbursementLog) || can(PERMISSIONS.disbursementManage)) &&
    can(PERMISSIONS.clientRead);
  const canManage = can(PERMISSIONS.disbursementManage);

  const tabParam = params.get('status');
  const tab: Tab = TABS.find((item) => item.value === tabParam)?.value ?? 'all';
  const clientId = params.get('client_id');
  const billable = params.get('billable');
  const dateFrom = isoDate(params.get('date_from'));
  const dateTo = isoDate(params.get('date_to'));

  const list = useDisbursementList(
    {
      client_id: clientId ?? undefined,
      billing_status: tab === 'all' ? undefined : [tab],
      is_billable: billable === 'true' ? true : billable === 'false' ? false : undefined,
      date_from: dateFrom ?? undefined,
      date_to: dateTo ?? undefined,
    },
    { enabled: canRead },
  );
  const remove = useDeleteDisbursement();

  const [dialog, setDialog] = useState<DialogState>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const close = () => setDialog(null);
  const editing = dialog?.type === 'form' ? dialog.disbursement : null;
  const editClient = useClientName(editing?.client_id);
  const editJob = useJobName(editing?.job_id);

  const rows = flattenPages(list.data);
  const activeFilters =
    Number(clientId !== null) +
    Number(billable === 'true' || billable === 'false') +
    Number(dateFrom !== null) +
    Number(dateTo !== null);
  const filtered = tab !== 'all' || activeFilters > 0;

  /** Unbilled, and the caller recorded it or may manage them all. */
  const mayChange = (row: Disbursement) =>
    row.billing_status === 'unbilled' &&
    (canManage || (row.created_by === user?.id && can(PERMISSIONS.disbursementLog)));

  const confirmDelete = () => {
    if (dialog?.type !== 'delete') return;
    remove.mutate(dialog.disbursement.id, {
      onSuccess: () => {
        toast({ tone: 'success', title: 'Disbursement deleted' });
        close();
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  const actionsFor = (row: Disbursement): DropdownItem[] => [
    {
      id: 'edit',
      label: 'Edit',
      icon: <Pencil aria-hidden="true" className="size-4" />,
      onSelect: () => setDialog({ type: 'form', disbursement: row }),
    },
    { id: 'separator', separator: true },
    {
      id: 'delete',
      label: 'Delete',
      tone: 'danger',
      icon: <Trash2 aria-hidden="true" className="size-4" />,
      onSelect: () => {
        setRefusal(null);
        setDialog({ type: 'delete', disbursement: row });
      },
    },
  ];

  const vatName = (id: string | null) => {
    if (!id) return 'Default';
    const code = vatCodes.data?.find((entry) => entry.id === id);
    return code ? `${code.name} (${formatBasisPoints(code.rate_bp)})` : 'VAT code';
  };

  const columns: DataTableColumn<Disbursement>[] = [
    {
      id: 'date',
      header: 'Date',
      className: 'w-28 whitespace-nowrap',
      cell: (row) => formatUkDate(row.incurred_on),
    },
    {
      id: 'description',
      header: 'Description',
      hideable: false,
      className: 'min-w-56 max-w-80',
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-text" title={row.description}>
            {row.description}
          </span>
          {row.supplier ? <span className="text-xs text-text-muted">{row.supplier}</span> : null}
        </div>
      ),
    },
    {
      id: 'client',
      header: 'Client',
      className: 'min-w-40 max-w-56',
      cell: (row) => <ClientCell clientId={row.client_id} />,
    },
    {
      id: 'job',
      header: 'Job',
      className: 'min-w-40 max-w-56',
      cell: (row) => <JobCell jobId={row.job_id} />,
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'end',
      className: 'w-28 whitespace-nowrap',
      cell: (row) => (
        <span className="font-semibold tabular-nums">{formatMoney(row.amount, currency)}</span>
      ),
    },
    {
      id: 'vat',
      header: 'VAT code',
      className: 'min-w-36',
      cell: (row) => vatName(row.vat_rate_id),
    },
    {
      id: 'billable',
      header: 'Billable',
      className: 'w-32 whitespace-nowrap',
      cell: (row) => (
        <Badge tone={row.is_billable ? 'green' : 'grey'} size="sm">
          {row.is_billable ? 'Billable' : 'Not billable'}
        </Badge>
      ),
    },
    {
      id: 'billing',
      header: 'Billing',
      className: 'w-44 whitespace-nowrap',
      cell: (row) => <BillingBadge status={row.billing_status} />,
    },
  ];

  if (!canRead) return <NoAccess what="seeing disbursements" />;

  return (
    <PageShell
      title="Disbursements"
      description="Costs paid on a client's behalf, to recharge to them. Billable ones are work in progress until they are invoiced."
    >
      <DisbursementFormPanel
        disbursement={editing}
        names={{
          client: editClient.data?.name,
          job: editJob.data ? { number: editJob.data.number, name: editJob.data.name } : undefined,
        }}
        open={dialog?.type === 'form'}
        onClose={close}
      />
      {list.isError && !list.data ? (
        <LoadError
          title="Could not load the disbursements"
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : (
        <DataTable
          caption="Disbursements"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={list.isPending}
          toolbar={
            <PageToolbar
              start={
                <CountTabs
                  label="Billing status"
                  items={TABS.map((item) => ({ value: item.value, label: item.label }))}
                  value={tab}
                  onChange={(value) => setParam({ status: value === 'all' ? null : value })}
                />
              }
              actions={
                <FilterPopover
                  title="Filter disbursements"
                  count={activeFilters}
                  onClear={() =>
                    setParam({ client_id: null, billable: null, date_from: null, date_to: null })
                  }
                >
                  {can(PERMISSIONS.clientRead) ? (
                    <ClientPicker
                      label="Client"
                      clearable
                      value={clientId}
                      onChange={(id) => setParam({ client_id: id })}
                    />
                  ) : null}
                  <DateRangeField
                    label="Dates"
                    value={{ from: dateFrom, to: dateTo }}
                    onChange={(range) => setParam({ date_from: range.from, date_to: range.to })}
                  />
                  <Select
                    label="Billable"
                    options={BILLABLE_OPTIONS}
                    value={billable ?? ''}
                    onChange={(event) => setParam({ billable: event.target.value || null })}
                  />
                </FilterPopover>
              }
              primaryAction={
                canRecord ? (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus aria-hidden="true" className="size-4" />}
                    onClick={() => setDialog({ type: 'form', disbursement: null })}
                  >
                    Record disbursement
                  </Button>
                ) : undefined
              }
            />
          }
          rowActions={(row) =>
            mayChange(row) ? (
              <Dropdown
                label={`Actions for ${row.description}`}
                items={actionsFor(row)}
                trigger={<Ellipsis aria-hidden="true" className="size-5 text-text-muted" />}
              />
            ) : null
          }
          empty={
            filtered ? (
              <EmptyState
                icon={<SearchX className="size-6" />}
                title="No disbursements match"
                description="Try a different filter."
                action={
                  <Button
                    onClick={() =>
                      setParam({
                        status: null,
                        client_id: null,
                        billable: null,
                        date_from: null,
                        date_to: null,
                      })
                    }
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<HandCoins className="size-6" />}
                title="No disbursements yet"
                description="Record a cost you paid for a client, such as a Companies House fee, to recharge it to them."
                action={
                  canRecord ? (
                    <Button
                      variant="primary"
                      onClick={() => setDialog({ type: 'form', disbursement: null })}
                    >
                      Record disbursement
                    </Button>
                  ) : undefined
                }
              />
            )
          }
          footer={
            rows.length > 0 ? (
              <div className="border-t border-row-border px-4 py-3">
                <Pagination
                  hasMore={list.hasNextPage}
                  onLoadMore={() => void list.fetchNextPage()}
                  loading={list.isFetchingNextPage}
                  count={rows.length}
                  itemLabel={['disbursement', 'disbursements']}
                />
              </div>
            ) : undefined
          }
        />
      )}

      <ConfirmDialog
        open={dialog?.type === 'delete'}
        onClose={close}
        onConfirm={confirmDelete}
        title="Delete this disbursement?"
        confirmLabel="Delete disbursement"
        loading={remove.isPending}
        error={refusal}
      >
        <p>
          {dialog?.type === 'delete' ? dialog.disbursement.description : ''} will be removed and
          will no longer count as work in progress. This cannot be undone.
        </p>
      </ConfirmDialog>
    </PageShell>
  );
}
