import { ArrowLeftRight, ClipboardList, SearchX, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  ColumnVisibilityMenu,
  CountTabs,
  DataTable,
  EmptyState,
  PageToolbar,
  Pagination,
  SearchField,
  Select,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, usePersistentColumns, useUrlParams } from '@/hooks';
import { formatMoney } from '@/utils/money';

import { flattenPages, useWipItems } from '../api';
import { FilterPopover } from '../components/FilterPopover';
import { itemColumns } from '../components/itemColumns';
import { LoadError, PageShell } from '../components/PageShell';
import { TransferDialog } from '../components/TransferDialog';
import { WipFilterFields } from '../components/WipFilterFields';
import { WriteOffDialog } from '../components/WriteOffDialog';
import { ITEM_KIND_META } from '../constants';
import { useUrlSearch } from '../hooks/useUrlSearch';
import { CLEARED_FILTERS, useWipFilters } from '../hooks/useWipFilters';
import {
  ITEM_SORTS,
  WIP_ITEM_KINDS,
  type ItemFilters,
  type SortOrder,
  type WipItem,
  type WipItemKind,
} from '../types';
import { isTakeable, itemKey, transferProblem, writeOffProblem } from '../utils/items';

type Tab = 'all' | WipItemKind;

const TAB_LABEL: Record<WipItemKind, string> = {
  time: 'Time',
  disbursement: 'Disbursements',
  expense: 'Expenses',
  fixed_fee: 'Fixed fees',
  adjustment: 'Adjustments',
};

const TABS: ReadonlyArray<{ value: Tab; label: string }> = [
  { value: 'all', label: 'All items' },
  ...WIP_ITEM_KINDS.map((kind) => ({ value: kind, label: TAB_LABEL[kind] })),
];

/** "At least this old", matching the ageing buckets: over 30, 60 and 90 days. */
const AGE_OPTIONS = [
  { value: '', label: 'Any age' },
  { value: '31', label: 'Over 30 days old' },
  { value: '61', label: 'Over 60 days old' },
  { value: '91', label: 'Over 90 days old' },
] as const;

/** /:orgSlug/wip/details: the unbilled items behind the figures, to write off or transfer. */
export default function WipDetailsPage() {
  useDocumentTitle('WIP Details');
  const { organization, can } = useOrg();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();
  const { filters: base, active: baseActive, setFilters } = useWipFilters();

  const tabParam = params.get('kind');
  const tab: Tab = TABS.find((item) => item.value === tabParam)?.value ?? 'all';
  const minAgeParam = params.get('min_age');
  const minAge = AGE_OPTIONS.find((item) => item.value === minAgeParam && item.value !== '')?.value;
  const sort = ITEM_SORTS.find((item) => item === params.get('sort')) ?? 'date';
  const orderParam = params.get('order');
  const order: SortOrder =
    orderParam === 'asc' || orderParam === 'desc' ? orderParam : sort === 'value' ? 'desc' : 'asc';

  const filters: ItemFilters = {
    ...base,
    kind: tab === 'all' ? undefined : [tab],
    min_age_days: minAge ? Number(minAge) : undefined,
    q: searched || undefined,
    sort,
    order,
  };
  const list = useWipItems(filters);
  const rows = flattenPages(list.data);

  const canWriteOff = can(PERMISSIONS.wipWriteOff);
  const canTransfer = can(PERMISSIONS.wipTransfer);
  const [hidden, setHidden] = usePersistentColumns('wip-details', ['rate']);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [writingOff, setWritingOff] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const activeFilters = baseActive + Number(minAge !== undefined);
  const filtered = searched !== '' || tab !== 'all' || activeFilters > 0;
  const currency = organization.currency;

  const chosen: WipItem[] = rows.filter((item) => selected.has(itemKey(item)));
  const takeable = chosen.filter(isTakeable);
  const skipped = chosen.length - takeable.length;
  const total = takeable.reduce((sum, item) => sum + item.value, 0);
  const writeOffBlock = writeOffProblem(takeable);
  const first = takeable[0];
  const preset =
    first?.client && first.job
      ? { client: first.client, fromJob: first.job, items: takeable }
      : null;
  const transferBlock =
    transferProblem(takeable) ??
    (preset ? null : 'Items without a client or a job cannot be transferred.');

  const columns = itemColumns({
    slug: organization.slug,
    currency,
    canOpenJob: can(PERMISSIONS.jobRead),
  });

  const clearAll = () => {
    setSearchText('');
    setParam({ q: null, kind: null, min_age: null, ...CLEARED_FILTERS });
  };
  const done = () => {
    setSelected(new Set());
    setWritingOff(false);
    setTransferring(false);
  };

  const selectionBar =
    chosen.length > 0 ? (
      <div
        role="status"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-brand/30 bg-brand/5 px-3 py-2 text-sm"
      >
        <span className="font-medium text-text">
          {chosen.length} selected, {formatMoney(total, currency)}
        </span>
        {skipped > 0 ? (
          <span className="text-xs text-text-muted">
            {skipped === 1 ? '1 selected item is' : `${String(skipped)} selected items are`} a fixed
            fee or an adjustment and cannot be taken out of WIP by id.
          </span>
        ) : null}
        <span className="ms-auto flex flex-wrap items-center gap-2">
          {canWriteOff ? (
            <Button
              size="sm"
              variant="danger"
              leftIcon={<Trash2 aria-hidden="true" className="size-4" />}
              disabled={writeOffBlock !== null}
              title={writeOffBlock ?? undefined}
              onClick={() => setWritingOff(true)}
            >
              Write off
            </Button>
          ) : null}
          {canTransfer ? (
            <Button
              size="sm"
              leftIcon={<ArrowLeftRight aria-hidden="true" className="size-4" />}
              disabled={transferBlock !== null}
              title={transferBlock ?? undefined}
              onClick={() => setTransferring(true)}
            >
              Transfer
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </span>
      </div>
    ) : null;

  return (
    <PageShell
      title="WIP Details"
      description="The unbilled work behind the figures: time, disbursements, expenses, fixed fees and adjustments."
    >
      {list.isError && !list.data ? (
        <LoadError
          title="Could not load the WIP items"
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : (
        <DataTable
          caption="WIP items"
          columns={columns}
          rows={rows}
          rowKey={itemKey}
          sort={{ columnId: sort, direction: order }}
          onSortChange={(next) => setParam({ sort: next.columnId, order: next.direction })}
          hiddenColumns={hidden}
          loading={list.isPending}
          selectable={canWriteOff || canTransfer}
          selected={selected}
          onSelectedChange={setSelected}
          selectLabel={(item) => `Select ${item.description ?? ITEM_KIND_META[item.kind].label}`}
          toolbar={
            <>
              <PageToolbar
                start={
                  <CountTabs
                    label="Kind of item"
                    items={TABS}
                    value={tab}
                    onChange={(value) => setParam({ kind: value === 'all' ? null : value })}
                  />
                }
                search={
                  <SearchField
                    label="Search WIP items"
                    placeholder="Description, client or job"
                    value={searchText}
                    onChange={setSearchText}
                  />
                }
                actions={
                  <>
                    <FilterPopover
                      title="Filter WIP items"
                      count={activeFilters}
                      onClear={() => setParam({ min_age: null, ...CLEARED_FILTERS })}
                    >
                      <WipFilterFields value={base} onChange={setFilters} />
                      <Select
                        label="Age"
                        options={AGE_OPTIONS}
                        value={minAge ?? ''}
                        onChange={(event) => setParam({ min_age: event.target.value || null })}
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
              />
              {selectionBar}
            </>
          }
          empty={
            filtered ? (
              <EmptyState
                icon={<SearchX className="size-6" />}
                title="No items match"
                description="Try a different search, kind of item or filter."
                action={<Button onClick={clearAll}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={<ClipboardList className="size-6" />}
                title="No work in progress"
                description="Billable time, disbursements and approved expenses appear here until they are billed."
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
                  itemLabel={['item', 'items']}
                />
              </div>
            ) : undefined
          }
        />
      )}

      <WriteOffDialog
        open={writingOff && writeOffBlock === null}
        onClose={() => setWritingOff(false)}
        items={takeable}
        onDone={done}
      />
      <TransferDialog
        open={transferring && preset !== null}
        onClose={() => setTransferring(false)}
        preset={preset}
        onDone={done}
      />
    </PageShell>
  );
}
