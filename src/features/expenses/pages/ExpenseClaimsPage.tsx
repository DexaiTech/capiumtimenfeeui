import { CircleCheck, ExternalLink, Plus, ReceiptText, Redo2, SearchX, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import {
  Button,
  Card,
  ColumnVisibilityMenu,
  ConfirmDialog,
  CountTabs,
  DataTable,
  DateRangeField,
  EmptyState,
  PageToolbar,
  Pagination,
  SearchField,
  Select,
  useToast,
  type DropdownItem,
  RowActions,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { ClientPicker, StaffPicker } from '@/features/team';
import { useDocumentTitle, usePersistentColumns, useUrlParams } from '@/hooks';
import { formatMoney } from '@/utils/money';

import { flattenPages, useClaimList, useDeleteClaim, useExpenseSummary } from '../api';
import {
  CLAIM_SORTS,
  claimColumns,
  defaultOrder,
  sortOfColumn,
  tableSort,
} from '../components/claimColumns';
import { ApproveDialog, BulkApproveDialog, ReturnDialog } from '../components/DecisionDialogs';
import { FilterPopover } from '../components/FilterPopover';
import { NewClaimPanel } from '../components/NewClaimPanel';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { CLAIM_STATUS_META } from '../constants';
import { useUrlSearch } from '../hooks/useUrlSearch';
import {
  CLAIM_STATUSES,
  type ClaimFilters,
  type ClaimStatus,
  type ExpenseClaim,
  type SortOrder,
} from '../types';
import { dialogError } from '../utils/errors';
import { claimLabel, pluralize } from '../utils/format';

type Tab = 'all' | ClaimStatus;

const BILLABLE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'true', label: 'Has a billable expense' },
  { value: 'false', label: 'Has a non-billable expense' },
];

const isoDate = (value: string | null) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

type DialogState =
  | { type: 'approve'; claim: ExpenseClaim }
  | { type: 'return'; claim: ExpenseClaim }
  | { type: 'delete'; claim: ExpenseClaim }
  | { type: 'bulk' }
  | { type: 'new' }
  | null;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-base font-semibold text-text tabular-nums">{value}</dd>
      {hint ? <p className="text-2xs text-text-subtle">{hint}</p> : null}
    </div>
  );
}

/**
 * `/:orgSlug/expenses`: every claim the caller may see (`expense.read_all`, `expense.manage`),
 * with the status counts, filters, bulk approval and the way to open, decide on or delete one.
 */
export default function ExpenseClaimsPage() {
  useDocumentTitle('Expense Claims');
  const { organization, can } = useOrg();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();

  const canSee = can(PERMISSIONS.expenseReadAll) || can(PERMISSIONS.expenseManage);
  const canApprove = can(PERMISSIONS.expenseApprove);
  const canCreate = can(PERMISSIONS.expenseLog) || can(PERMISSIONS.expenseManage);
  const currency = organization.currency;

  const summary = useExpenseSummary({ enabled: canSee });
  const tabs: ReadonlyArray<{ value: Tab; label: string; count: number | null }> = [
    { value: 'all', label: 'All claims', count: summary.data?.counts.total ?? null },
    ...CLAIM_STATUSES.map((status) => ({
      value: status,
      label: CLAIM_STATUS_META[status].label,
      count: summary.data?.counts[status] ?? null,
    })),
  ];
  const tabParam = params.get('status');
  const tab: Tab = tabs.find((item) => item.value === tabParam)?.value ?? 'all';
  const sort = CLAIM_SORTS.find((item) => item === params.get('sort')) ?? 'created_at';
  const orderParam = params.get('order');
  const order: SortOrder =
    orderParam === 'asc' || orderParam === 'desc' ? orderParam : defaultOrder(sort);
  const userId = params.get('user_id');
  const clientId = params.get('client_id');
  const billable = params.get('billable');
  const dateFrom = isoDate(params.get('date_from'));
  const dateTo = isoDate(params.get('date_to'));

  const filters: ClaimFilters = {
    status: tab === 'all' ? undefined : [tab],
    user_id: userId ?? undefined,
    client_id: clientId ?? undefined,
    is_billable: billable === 'true' ? true : billable === 'false' ? false : undefined,
    q: searched || undefined,
    date_from: dateFrom ?? undefined,
    date_to: dateTo ?? undefined,
    sort,
    order,
  };
  const list = useClaimList(filters, { enabled: canSee });
  const remove = useDeleteClaim();

  const [hidden, setHidden] = usePersistentColumns('expense-claims');
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const close = () => setDialog(null);

  const rows = flattenPages(list.data);
  const approvable = rows.filter((claim) => selected.has(claim.id) && claim.actions.can_approve);
  const activeFilters =
    Number(userId !== null) +
    Number(clientId !== null) +
    Number(billable === 'true' || billable === 'false') +
    Number(dateFrom !== null) +
    Number(dateTo !== null);
  const filtered = searched !== '' || tab !== 'all' || activeFilters > 0;
  const shown = rows.reduce(
    (sum, claim) => ({
      gross: sum.gross + claim.totals.gross,
      recharge: sum.recharge + claim.totals.recharge,
    }),
    { gross: 0, recharge: 0 },
  );

  const clearAll = () => {
    setSearchText('');
    setParam({
      q: null,
      status: null,
      user_id: null,
      client_id: null,
      billable: null,
      date_from: null,
      date_to: null,
    });
  };

  const confirmDelete = (claim: ExpenseClaim) => {
    remove.mutate(claim.id, {
      onSuccess: () => {
        toast({ tone: 'success', title: 'Claim deleted', description: claimLabel(claim) });
        close();
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  const actionsFor = (claim: ExpenseClaim): DropdownItem[] => {
    const items: DropdownItem[] = [
      {
        id: 'open',
        label: 'Open',
        icon: <ExternalLink aria-hidden="true" className="size-4" />,
        onSelect: () =>
          void navigate(routes.org.expenseClaim(organization.slug, claim.id, 'claims')),
      },
    ];
    if (claim.actions.can_approve) {
      items.push({
        id: 'approve',
        label: 'Approve',
        icon: <CircleCheck aria-hidden="true" className="size-4" />,
        onSelect: () => setDialog({ type: 'approve', claim }),
      });
    }
    if (claim.actions.can_return) {
      items.push({
        id: 'return',
        label: 'Return',
        icon: <Redo2 aria-hidden="true" className="size-4" />,
        onSelect: () => setDialog({ type: 'return', claim }),
      });
    }
    if (claim.actions.can_delete) {
      items.push(
        { id: 'separator', separator: true },
        {
          id: 'delete',
          label: 'Delete',
          tone: 'danger',
          icon: <Trash2 aria-hidden="true" className="size-4" />,
          onSelect: () => {
            setRefusal(null);
            setDialog({ type: 'delete', claim });
          },
        },
      );
    }
    return items;
  };

  const columns = claimColumns({
    slug: organization.slug,
    list: 'claims',
    showClaimant: true,
    currency,
  });

  if (!canSee) return <NoAccess what="seeing everyone's expense claims" />;

  const target = dialog && 'claim' in dialog ? dialog.claim : null;

  return (
    <PageShell
      title="Expense Claims"
      description="Every claim of the practice: filter them, open one, approve or return the ones waiting, or start a claim for a member of staff."
    >
      <NewClaimPanel
        open={dialog?.type === 'new'}
        onClose={close}
        onCreated={(claim) => {
          close();
          void navigate(routes.org.expenseClaim(organization.slug, claim.id, 'claims'));
        }}
      />
      {summary.data ? (
        <Card padding="sm">
          <dl aria-label="Claims at a glance" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Claims" value={String(summary.data.counts.total)} />
            <Stat
              label="Waiting for approval"
              value={formatMoney(summary.data.pending_gross, currency)}
              hint={pluralize(summary.data.counts.submitted, 'claim')}
            />
            <Stat label="Returned" value={String(summary.data.counts.returned)} />
            {canApprove ? (
              <Stat
                label="Waiting for you"
                value={formatMoney(summary.data.awaiting_my_approval.gross, currency)}
                hint={pluralize(summary.data.awaiting_my_approval.count, 'claim')}
              />
            ) : (
              <Stat label="Approved" value={String(summary.data.counts.approved)} />
            )}
          </dl>
        </Card>
      ) : null}
      {list.isError && !list.data ? (
        <LoadError
          title="Could not load the claims"
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : (
        <DataTable
          caption="Expense claims"
          columns={columns}
          rows={rows}
          rowKey={(claim) => claim.id}
          selectable={canApprove}
          selected={selected}
          onSelectedChange={setSelected}
          selectLabel={(claim) => `Select ${claimLabel(claim)}`}
          sort={tableSort(sort, order)}
          onSortChange={(next) => {
            const key = sortOfColumn(next.columnId);
            if (key) setParam({ sort: key, order: next.direction });
          }}
          hiddenColumns={hidden}
          loading={list.isPending}
          toolbar={
            <PageToolbar
              start={
                <CountTabs
                  label="Claim status"
                  items={tabs}
                  value={tab}
                  onChange={(value) => setParam({ status: value === 'all' ? null : value })}
                />
              }
              search={
                <SearchField
                  label="Search claims"
                  placeholder="Quick search"
                  value={searchText}
                  onChange={setSearchText}
                />
              }
              actions={
                <>
                  <FilterPopover
                    title="Filter claims"
                    count={activeFilters}
                    onClear={() =>
                      setParam({
                        user_id: null,
                        client_id: null,
                        billable: null,
                        date_from: null,
                        date_to: null,
                      })
                    }
                  >
                    <StaffPicker
                      label="Claimant"
                      clearable
                      includeLeft
                      value={userId}
                      onChange={(id) => setParam({ user_id: id })}
                    />
                    {can(PERMISSIONS.clientRead) ? (
                      <ClientPicker
                        label="Client"
                        clearable
                        value={clientId}
                        onChange={(id) => setParam({ client_id: id })}
                      />
                    ) : null}
                    <DateRangeField
                      label="Dates of the expenses"
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
                  <ColumnVisibilityMenu
                    columns={columns.map((column) => ({
                      id: column.id,
                      label: column.header,
                      locked: column.hideable === false,
                    }))}
                    hidden={hidden}
                    onChange={setHidden}
                  />
                  {canApprove ? (
                    <Button
                      variant="brand-outline"
                      size="sm"
                      disabled={approvable.length === 0}
                      onClick={() => setDialog({ type: 'bulk' })}
                      leftIcon={<CircleCheck aria-hidden="true" className="size-4" />}
                    >
                      Approve selected ({approvable.length})
                    </Button>
                  ) : null}
                </>
              }
              primaryAction={
                canCreate ? (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus aria-hidden="true" className="size-4" />}
                    onClick={() => setDialog({ type: 'new' })}
                  >
                    New claim
                  </Button>
                ) : undefined
              }
            />
          }
          rowActions={(claim) => (
            <RowActions label={`Actions for ${claimLabel(claim)}`} items={actionsFor(claim)} />
          )}
          empty={
            filtered ? (
              <EmptyState
                icon={<SearchX className="size-6" />}
                title="No claims match"
                description="Try a different search, status or filter."
                action={<Button onClick={clearAll}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={<ReceiptText className="size-6" />}
                title="No expense claims yet"
                description="Claims appear here as staff record and submit them."
              />
            )
          }
          footer={
            rows.length > 0 ? (
              <div className="flex flex-col gap-2 border-t border-row-border px-4 py-3">
                <p className="text-xs text-text-muted">
                  The {pluralize(rows.length, 'claim')} shown come to{' '}
                  <strong className="text-text">{formatMoney(shown.gross, currency)}</strong>, of
                  which {formatMoney(shown.recharge, currency)} is recharged to clients.
                </p>
                <Pagination
                  hasMore={list.hasNextPage}
                  onLoadMore={() => void list.fetchNextPage()}
                  loading={list.isFetchingNextPage}
                  count={rows.length}
                  itemLabel={['claim', 'claims']}
                />
              </div>
            ) : undefined
          }
        />
      )}

      {target && dialog?.type === 'approve' ? (
        <ApproveDialog claim={target} open onClose={close} />
      ) : null}
      {target && dialog?.type === 'return' ? (
        <ReturnDialog claim={target} open onClose={close} />
      ) : null}
      <BulkApproveDialog
        claims={approvable}
        open={dialog?.type === 'bulk'}
        onClose={close}
        onDone={() => {
          setSelected(new Set());
          close();
        }}
      />
      <ConfirmDialog
        open={dialog?.type === 'delete'}
        onClose={close}
        onConfirm={() => {
          if (dialog?.type === 'delete') confirmDelete(dialog.claim);
        }}
        title="Delete this claim?"
        confirmLabel="Delete claim"
        loading={remove.isPending}
        error={refusal}
      >
        <p>
          {dialog?.type === 'delete' ? claimLabel(dialog.claim) : ''} and its expenses will be
          removed, with their receipts. This cannot be undone.
        </p>
      </ConfirmDialog>
    </PageShell>
  );
}
