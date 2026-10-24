import { Ellipsis, ExternalLink, Plus, SearchX, Trash2, Undo2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import {
  Button,
  ColumnVisibilityMenu,
  ConfirmDialog,
  CountTabs,
  DataTable,
  DateRangeField,
  Dropdown,
  EmptyState,
  PageToolbar,
  Pagination,
  SearchField,
  useToast,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, useUrlParams } from '@/hooks';

import { flattenPages, useClaimList, useDeleteClaim, useRecallClaim } from '../api';
import {
  CLAIM_SORTS,
  claimColumns,
  defaultOrder,
  sortOfColumn,
  tableSort,
} from '../components/claimColumns';
import { FilterPopover } from '../components/FilterPopover';
import { NewClaimPanel } from '../components/NewClaimPanel';
import { LoadError, PageShell } from '../components/PageShell';
import { CLAIM_STATUS_META } from '../constants';
import { useUrlSearch } from '../hooks/useUrlSearch';
import {
  CLAIM_STATUSES,
  type ClaimFilters,
  type ClaimStatus,
  type ExpenseClaim,
  type SortOrder,
} from '../types';
import { describeFailure, dialogError } from '../utils/errors';
import { claimLabel } from '../utils/format';

type Tab = 'all' | ClaimStatus;

const TABS: ReadonlyArray<{ value: Tab; label: string }> = [
  { value: 'all', label: 'All claims' },
  ...CLAIM_STATUSES.map((status) => ({ value: status, label: CLAIM_STATUS_META[status].label })),
];

const isoDate = (value: string | null) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

/** `/:orgSlug/expenses/mine`: the caller's own claims, and where a new one starts. */
export default function MyExpensesPage() {
  useDocumentTitle('My Expenses');
  const { organization, can } = useOrg();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();

  const canLog = can(PERMISSIONS.expenseLog);
  const tabParam = params.get('status');
  const tab: Tab = TABS.find((item) => item.value === tabParam)?.value ?? 'all';
  const sort = CLAIM_SORTS.find((item) => item === params.get('sort')) ?? 'created_at';
  const orderParam = params.get('order');
  const order: SortOrder =
    orderParam === 'asc' || orderParam === 'desc' ? orderParam : defaultOrder(sort);
  const dateFrom = isoDate(params.get('date_from'));
  const dateTo = isoDate(params.get('date_to'));

  const filters: ClaimFilters = {
    mine: true,
    status: tab === 'all' ? undefined : [tab],
    q: searched || undefined,
    date_from: dateFrom ?? undefined,
    date_to: dateTo ?? undefined,
    sort,
    order,
  };
  const list = useClaimList(filters, { enabled: canLog });
  const recall = useRecallClaim();
  const remove = useDeleteClaim();

  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [creating, setCreating] = useState(() => canLog && params.get('new') === '1');
  const [deleting, setDeleting] = useState<ExpenseClaim | null>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);

  const rows = flattenPages(list.data);
  const activeFilters = Number(dateFrom !== null) + Number(dateTo !== null);
  const filtered = searched !== '' || tab !== 'all' || activeFilters > 0;

  const closeCreate = () => {
    setCreating(false);
    if (params.has('new')) setParam({ new: null });
  };
  const clearAll = () => {
    setSearchText('');
    setParam({ q: null, status: null, date_from: null, date_to: null });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const claim = deleting;
    remove.mutate(claim.id, {
      onSuccess: () => {
        toast({ tone: 'success', title: 'Claim deleted', description: claimLabel(claim) });
        setDeleting(null);
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
        onSelect: () => void navigate(routes.org.expenseClaim(organization.slug, claim.id, 'mine')),
      },
    ];
    if (claim.actions.can_recall) {
      items.push({
        id: 'recall',
        label: 'Recall',
        icon: <Undo2 aria-hidden="true" className="size-4" />,
        onSelect: () => {
          recall.mutate(claim.id, {
            onSuccess: () => toast({ tone: 'success', title: 'Claim recalled' }),
            onError: (error) =>
              toast({ tone: 'error', ...describeFailure(error, 'Could not recall the claim') }),
          });
        },
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
            setDeleting(claim);
          },
        },
      );
    }
    return items;
  };

  const columns = claimColumns({
    slug: organization.slug,
    list: 'mine',
    showClaimant: false,
    currency: organization.currency,
  });

  if (!canLog) {
    return (
      <PageShell title="My Expenses">
        <EmptyState
          title="You cannot record expenses"
          description="Your role in this practice does not include recording expense claims."
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="My Expenses"
      description="Your expense claims: record what you spent, attach the receipts and send the claim for approval."
    >
      <NewClaimPanel
        open={creating}
        onClose={closeCreate}
        onCreated={(claim) => {
          closeCreate();
          void navigate(routes.org.expenseClaim(organization.slug, claim.id, 'mine'));
        }}
      />
      {list.isError && !list.data ? (
        <LoadError
          title="Could not load your claims"
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : (
        <DataTable
          caption="My expense claims"
          columns={columns}
          rows={rows}
          rowKey={(claim) => claim.id}
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
                  items={TABS.map((item) => ({ value: item.value, label: item.label }))}
                  value={tab}
                  onChange={(value) => setParam({ status: value === 'all' ? null : value })}
                />
              }
              search={
                <SearchField
                  label="Search my claims"
                  placeholder="Quick search"
                  value={searchText}
                  onChange={setSearchText}
                />
              }
              actions={
                <>
                  <FilterPopover
                    title="Filter my claims"
                    count={activeFilters}
                    onClear={() => setParam({ date_from: null, date_to: null })}
                  >
                    <DateRangeField
                      label="Dates of the expenses"
                      value={{ from: dateFrom, to: dateTo }}
                      onChange={(range) => setParam({ date_from: range.from, date_to: range.to })}
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
                </>
              }
              primaryAction={
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus aria-hidden="true" className="size-4" />}
                  onClick={() => setCreating(true)}
                >
                  New claim
                </Button>
              }
            />
          }
          rowActions={(claim) => (
            <Dropdown
              label={`Actions for ${claimLabel(claim)}`}
              items={actionsFor(claim)}
              trigger={<Ellipsis aria-hidden="true" className="size-5 text-text-muted" />}
            />
          )}
          empty={
            filtered ? (
              <EmptyState
                icon={<SearchX className="size-6" />}
                title="No claims match"
                description="Try a different search, status or dates."
                action={<Button onClick={clearAll}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={<Wallet className="size-6" />}
                title="No expense claims yet"
                description="Start a claim for what you spent for the practice: train fares, mileage, a hotel."
                action={
                  <Button variant="primary" onClick={() => setCreating(true)}>
                    New claim
                  </Button>
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
                  itemLabel={['claim', 'claims']}
                />
              </div>
            ) : undefined
          }
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete this claim?"
        confirmLabel="Delete claim"
        loading={remove.isPending}
        error={refusal}
      >
        <p>
          {deleting ? claimLabel(deleting) : ''} and its expenses will be removed, with their
          receipts. This cannot be undone.
        </p>
      </ConfirmDialog>
    </PageShell>
  );
}
