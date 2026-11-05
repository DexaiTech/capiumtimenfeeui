import { ArrowLeftRight, ClipboardList, SearchX, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import {
  Button,
  ColumnVisibilityMenu,
  CountTabs,
  DataTable,
  EmptyState,
  PageToolbar,
  Pagination,
  SearchField,
  SegmentedControl,
  Select,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { modulePath, ORG_SEGMENTS } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, usePersistentColumns, useUrlParams } from '@/hooks';
import { formatMoney } from '@/utils/money';

import { flattenPages, summaryRows, useWipItems, useWipSummary } from '../api';
import { FilterPopover } from '../components/FilterPopover';
import { itemColumns } from '../components/itemColumns';
import { jobLineColumns } from '../components/jobLineColumns';
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
  type SummarySort,
  type WipGroupRow,
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

type View = 'jobs' | 'items';

const VIEWS: ReadonlyArray<{ value: View; label: string }> = [
  { value: 'jobs', label: 'By job' },
  { value: 'items', label: 'By item' },
];

/** The sortable columns of the "By job" lines (sorts of `GET /wip/summary`). */
const JOB_SORTS: ReadonlyArray<SummarySort> = ['name', 'total', 'items', 'oldest'];

/** "At least this old", matching the ageing buckets: over 30, 60 and 90 days. */
const AGE_OPTIONS = [
  { value: '', label: 'Any age' },
  { value: '31', label: 'Over 30 days old' },
  { value: '61', label: 'Over 60 days old' },
  { value: '91', label: 'Over 90 days old' },
] as const;

/**
 * /:orgSlug/wip/details: the unbilled WIP, one line per job ("By job", the default) that opens on
 * the job's items, or one row per item ("By item") to write off or transfer.
 */
export default function WipDetailsPage() {
  useDocumentTitle('WIP Details');
  const { organization, can } = useOrg();
  const { params, setParam } = useUrlParams();
  const navigate = useNavigate();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();
  const { filters: base, active: baseActive, setFilters } = useWipFilters();

  const tabParam = params.get('kind');
  const tab: Tab = TABS.find((item) => item.value === tabParam)?.value ?? 'all';
  const minAgeParam = params.get('min_age');
  const minAge = AGE_OPTIONS.find((item) => item.value === minAgeParam && item.value !== '')?.value;
  const viewParam = params.get('view');
  // One job's WIP is its items: a link to a job (from the summary, a report) opens on them.
  const view: View =
    viewParam === 'jobs' || viewParam === 'items' ? viewParam : base.job_id ? 'items' : 'jobs';
  const byJob = view === 'jobs';
  const sort = ITEM_SORTS.find((item) => item === params.get('sort')) ?? 'date';
  const jobSort = JOB_SORTS.find((item) => item === params.get('sort')) ?? 'oldest';
  const sortColumn = byJob ? jobSort : sort;
  const orderParam = params.get('order');
  const order: SortOrder =
    orderParam === 'asc' || orderParam === 'desc'
      ? orderParam
      : sortColumn === 'value' || sortColumn === 'total'
        ? 'desc'
        : 'asc';

  const filters: ItemFilters = {
    ...base,
    kind: tab === 'all' ? undefined : [tab],
    min_age_days: minAge ? Number(minAge) : undefined,
    q: searched || undefined,
    sort,
    order,
  };
  const list = useWipItems(filters, { enabled: !byJob });
  const rows = flattenPages(list.data);
  const jobs = useWipSummary(
    {
      ...base,
      group_by: 'job',
      kind: filters.kind,
      min_age_days: filters.min_age_days,
      q: filters.q,
      sort: jobSort,
      order,
    },
    { enabled: byJob },
  );
  const jobRows = summaryRows(jobs.data);
  const current = byJob ? jobs : list;
  const count = byJob ? jobRows.length : rows.length;

  const canWriteOff = can(PERMISSIONS.wipWriteOff);
  const canTransfer = can(PERMISSIONS.wipTransfer);
  const [hidden, setHidden] = usePersistentColumns('wip-details', ['rate']);
  const [hiddenJobColumns, setHiddenJobColumns] = usePersistentColumns('wip-details-jobs', []);
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
  /** A job opens on its items; the WIP of a client without a job, on the client's items. */
  const itemsHref = (row: WipGroupRow) => {
    const next = new URLSearchParams(params);
    // The search of the lines is by client or job name: it would not find the items.
    for (const key of ['q', 'sort', 'order', 'view']) next.delete(key);
    if (row.key) next.set('job_id', row.key);
    else {
      if (row.client) next.set('client_id', row.client.id);
      next.set('view', 'items');
    }
    return `${modulePath(organization.slug, ORG_SEGMENTS.wip, 'details')}?${next.toString()}`;
  };
  const jobColumns = jobLineColumns({ currency, itemsHref, onOpen: () => setSearchText('') });
  const visibleColumns = byJob ? jobColumns : columns;

  const clearAll = () => {
    setSearchText('');
    setParam({ q: null, kind: null, min_age: null, ...CLEARED_FILTERS });
  };
  const setView = (next: View) => {
    setSelected(new Set());
    setParam({ view: next, sort: null, order: null });
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

  const toolbar = (
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
          placeholder={byJob ? 'Client or job' : 'Client, job, item or person'}
          value={searchText}
          onChange={setSearchText}
        />
      }
      actions={
        <>
          <SegmentedControl label="Show" options={VIEWS} value={view} onChange={setView} />
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
            columns={visibleColumns.map((column) => ({
              id: column.id,
              label: column.header,
              locked: column.hideable === false,
            }))}
            hidden={byJob ? hiddenJobColumns : hidden}
            onChange={byJob ? setHiddenJobColumns : setHidden}
          />
        </>
      }
    />
  );
  const empty = filtered ? (
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
  );
  const footer =
    count > 0 ? (
      <div className="border-t border-row-border px-4 py-3">
        <Pagination
          hasMore={current.hasNextPage}
          onLoadMore={() => void current.fetchNextPage()}
          loading={current.isFetchingNextPage}
          count={count}
          itemLabel={byJob ? ['job', 'jobs'] : ['item', 'items']}
        />
      </div>
    ) : undefined;

  return (
    <PageShell
      title="WIP Details"
      description="The unbilled work behind the figures: time, disbursements, expenses, fixed fees and adjustments."
    >
      {current.isError && !current.data ? (
        <LoadError
          title="Could not load the WIP items"
          error={current.error}
          onRetry={() => void current.refetch()}
          retrying={current.isRefetching}
        />
      ) : byJob ? (
        <DataTable
          caption="WIP by job"
          columns={jobColumns}
          rows={jobRows}
          rowKey={(row) => `${row.client?.id ?? ''}:${row.key ?? 'none'}`}
          sort={{ columnId: jobSort, direction: order }}
          onSortChange={(next) => setParam({ sort: next.columnId, order: next.direction })}
          hiddenColumns={hiddenJobColumns}
          loading={jobs.isPending}
          onRowClick={(row) => {
            setSearchText('');
            void navigate(itemsHref(row));
          }}
          toolbar={toolbar}
          empty={empty}
          footer={footer}
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
              {toolbar}
              {selectionBar}
            </>
          }
          empty={empty}
          footer={footer}
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
