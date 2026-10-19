import { Gauge, SearchX } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import {
  Button,
  Card,
  ColumnVisibilityMenu,
  CountTabs,
  DataTable,
  EmptyState,
  PageToolbar,
  Pagination,
  SearchField,
  Select,
  type DataTableColumn,
  type DataTableSort,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { ClientPicker } from '@/features/team';
import { useDocumentTitle, useUrlParams } from '@/hooks';
import { formatUkDate } from '@/utils/dates';
import { formatBasisPoints, formatMoney } from '@/utils/money';

import { useBudgetList, useMembers } from '../api';
import { FilterPopover } from '../components/FilterPopover';
import { LoadError, PageShell } from '../components/PageShell';
import { JobStatusBadge, RagBadge, UsageBar } from '../components/StatusBadges';
import { JOB_STATUS_META, OPEN_JOB_STATUSES, RAG_META } from '../constants';
import { useUrlSearch } from '../hooks/useUrlSearch';
import {
  BUDGET_SORTS,
  JOB_STATUSES,
  type BudgetFilters,
  type BudgetSort,
  type JobBudgetRow,
  type JobStatus,
  type Rag,
  type SortOrder,
} from '../types';
import { hoursOf } from '../utils/format';

type RagTab = 'all' | Rag;

const RAG_TABS: ReadonlyArray<{ value: RagTab; label: string }> = [
  { value: 'all', label: 'All budgets' },
  { value: 'green', label: RAG_META.green.label },
  { value: 'amber', label: RAG_META.amber.label },
  { value: 'red', label: RAG_META.red.label },
];

/** The usage range of each traffic light, in basis points (80% and 100% are the thresholds). */
const RAG_RANGE: Record<Rag, Pick<BudgetFilters, 'used_from_bp' | 'used_to_bp'>> = {
  green: { used_to_bp: 7999 },
  amber: { used_from_bp: 8000, used_to_bp: 9999 },
  red: { used_from_bp: 10000 },
};

const STATUS_OPTIONS = [
  { value: '', label: 'Open jobs' },
  { value: 'all', label: 'Every status' },
  ...JOB_STATUSES.map((status) => ({ value: status, label: JOB_STATUS_META[status].label })),
];

const KEY_OF_COLUMN: Record<string, BudgetSort> = {
  job: 'number',
  client: 'client',
  due: 'due_date',
  hours: 'logged_minutes',
  value: 'time_value',
  used: 'used',
};
const COLUMN_OF_KEY: Partial<Record<BudgetSort, string>> = {
  number: 'job',
  client: 'client',
  due_date: 'due',
  logged_minutes: 'hours',
  time_value: 'value',
  used: 'used',
};

/** The API sorts the budget used from the highest and everything else from the start. */
const defaultOrder = (sort: BudgetSort): SortOrder => (sort === 'used' ? 'desc' : 'asc');

/** `/:orgSlug/jobs/budgets`: budget against actual for every job that has a budget. */
export default function BudgetTrackingPage() {
  useDocumentTitle('Budget Tracking');
  const { organization, can } = useOrg();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();
  const members = useMembers();

  const ragParam = params.get('rag');
  const rag: RagTab = RAG_TABS.find((item) => item.value === ragParam)?.value ?? 'all';
  const statusParam = params.get('status');
  const sort = BUDGET_SORTS.find((item) => item === params.get('sort')) ?? 'used';
  const orderParam = params.get('order');
  const order: SortOrder =
    orderParam === 'asc' || orderParam === 'desc' ? orderParam : defaultOrder(sort);
  const manager = params.get('manager');
  const clientId = params.get('client_id');

  const statuses: JobStatus[] | undefined =
    statusParam === 'all'
      ? undefined
      : JOB_STATUSES.some((status) => status === statusParam)
        ? [statusParam as JobStatus]
        : [...OPEN_JOB_STATUSES];
  const filters: BudgetFilters = {
    status: statuses,
    manager_user_id: manager ?? undefined,
    client_id: clientId ?? undefined,
    q: searched || undefined,
    sort,
    order,
    ...(rag === 'all' ? {} : RAG_RANGE[rag]),
  };
  const list = useBudgetList(filters);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());

  const rows = list.data?.pages.flatMap((page) => page.data.rows) ?? [];
  const totals = list.data?.pages[0]?.data.totals;
  const activeFilters =
    Number(statusParam !== null) + Number(manager !== null) + Number(clientId !== null);
  const filtered = searched !== '' || rag !== 'all' || activeFilters > 0;
  const money = (pence: number) => formatMoney(pence, organization.currency);

  const columns: DataTableColumn<JobBudgetRow>[] = [
    {
      id: 'job',
      header: 'Job',
      hideable: false,
      sortable: true,
      className: 'min-w-56 max-w-96',
      cell: (row) => (
        <Link
          to={routes.org.job(organization.slug, row.job_id)}
          className="flex min-w-0 flex-col hover:text-brand-text"
          title={`${row.number} ${row.name}`}
        >
          <span className="truncate font-semibold text-text">{row.name}</span>
          <span className="text-xs text-text-muted">{row.number}</span>
        </Link>
      ),
    },
    {
      id: 'client',
      header: 'Client',
      sortable: true,
      className: 'min-w-40',
      cell: (row) => <span className="text-text">{row.client_name}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      className: 'w-36',
      cell: (row) => <JobStatusBadge status={row.status} />,
    },
    {
      id: 'manager',
      header: 'Manager',
      className: 'min-w-36',
      cell: (row) => <span className="text-text">{row.manager_name ?? '—'}</span>,
    },
    {
      id: 'due',
      header: 'Due',
      sortable: true,
      className: 'w-28 whitespace-nowrap',
      cell: (row) => (
        <span className="text-text">{row.due_date ? formatUkDate(row.due_date) : '—'}</span>
      ),
    },
    {
      id: 'hours',
      header: 'Hours',
      sortable: true,
      className: 'min-w-48',
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <span className="text-text tabular-nums">
            {hoursOf(row.logged_minutes, row.budget_minutes)}
          </span>
          <UsageBar label={`Hours budget of ${row.number}`} usageBp={row.budget_minutes_used_bp} />
        </div>
      ),
    },
    {
      id: 'value',
      header: 'Fee',
      sortable: true,
      className: 'min-w-48',
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <span className="text-text tabular-nums">
            {row.budget_fee === null
              ? money(row.time_value)
              : `${money(row.time_value)} of ${money(row.budget_fee)}`}
          </span>
          <UsageBar label={`Fee budget of ${row.number}`} usageBp={row.budget_fee_used_bp} />
        </div>
      ),
    },
    {
      id: 'used',
      header: 'Used',
      sortable: true,
      align: 'end',
      className: 'w-40',
      cell: (row) =>
        row.rag ? (
          <span className="inline-flex items-center justify-end gap-2">
            <span className="text-text tabular-nums">{formatBasisPoints(row.used_bp)}</span>
            <RagBadge rag={row.rag} />
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: 'wip',
      header: 'WIP',
      align: 'end',
      className: 'w-28 whitespace-nowrap',
      cell: (row) => <span className="text-text tabular-nums">{money(row.wip_value)}</span>,
    },
  ];

  const tableSort: DataTableSort = { columnId: COLUMN_OF_KEY[sort] ?? 'used', direction: order };
  const managerOptions = [
    { value: '', label: 'Anyone' },
    { value: 'me', label: 'Me' },
    ...(members.data ?? []).map((member) => ({ value: member.user_id, label: member.full_name })),
  ];
  const clearAll = () => {
    setSearchText('');
    setParam({ q: null, rag: null, status: null, manager: null, client_id: null });
  };

  return (
    <PageShell
      title="Budget Tracking"
      description="Hours and fees against budget for every job that has one: warned at 80% and again at 100%."
    >
      {totals ? (
        <dl aria-label="Totals of the budgets" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card padding="sm" className="flex flex-col gap-1">
            <dt className="text-xs text-text-muted">Jobs with a budget</dt>
            <dd className="text-xl font-semibold text-text tabular-nums">{totals.jobs}</dd>
            <p className="text-2xs text-text-subtle">
              {totals.red} over, {totals.amber} nearing, {totals.green} on budget
            </p>
          </Card>
          <Card padding="sm" className="flex flex-col gap-1">
            <dt className="text-xs text-text-muted">Hours logged</dt>
            <dd className="text-xl font-semibold text-text tabular-nums">
              {hoursOf(totals.logged_minutes, totals.budget_minutes || null)}
            </dd>
            <p className="text-2xs text-text-subtle">
              {totals.budget_minutes_used_bp === null
                ? 'No hours budgets'
                : `${formatBasisPoints(totals.budget_minutes_used_bp)} of the hours budgeted`}
            </p>
          </Card>
          <Card padding="sm" className="flex flex-col gap-1">
            <dt className="text-xs text-text-muted">Time value</dt>
            <dd className="text-xl font-semibold text-text tabular-nums">
              {money(totals.time_value)}
            </dd>
            <p className="text-2xs text-text-subtle">
              {totals.budget_fee_used_bp === null
                ? 'No fee budgets'
                : `${formatBasisPoints(totals.budget_fee_used_bp)} of ${money(totals.budget_fee)} budgeted`}
            </p>
          </Card>
          <Card padding="sm" className="flex flex-col gap-1">
            <dt className="text-xs text-text-muted">Work in progress</dt>
            <dd className="text-xl font-semibold text-text tabular-nums">
              {money(totals.wip_value)}
            </dd>
            <p className="text-2xs text-text-subtle">Billable time not yet billed</p>
          </Card>
        </dl>
      ) : null}
      {list.isError && !list.data ? (
        <LoadError
          title="Could not load the budgets"
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : (
        <DataTable
          caption="Job budgets"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.job_id}
          sort={tableSort}
          onSortChange={(next) => {
            const key = KEY_OF_COLUMN[next.columnId];
            if (key) setParam({ sort: key, order: next.direction });
          }}
          hiddenColumns={hidden}
          loading={list.isPending}
          toolbar={
            <PageToolbar
              start={
                <CountTabs
                  label="Budget status"
                  items={RAG_TABS.map((item) => ({ value: item.value, label: item.label }))}
                  value={rag}
                  onChange={(value) => setParam({ rag: value === 'all' ? null : value })}
                />
              }
              search={
                <SearchField
                  label="Search budgets"
                  placeholder="Job or client"
                  value={searchText}
                  onChange={setSearchText}
                />
              }
              actions={
                <>
                  <FilterPopover
                    title="Filter budgets"
                    count={activeFilters}
                    onClear={() => setParam({ status: null, manager: null, client_id: null })}
                  >
                    <Select
                      label="Jobs"
                      options={STATUS_OPTIONS}
                      value={statusParam ?? ''}
                      onChange={(event) => setParam({ status: event.target.value || null })}
                    />
                    <Select
                      label="Manager"
                      options={managerOptions}
                      value={manager ?? ''}
                      onChange={(event) => setParam({ manager: event.target.value || null })}
                    />
                    {can(PERMISSIONS.clientRead) ? (
                      <ClientPicker
                        label="Client"
                        clearable
                        value={clientId}
                        onChange={(id) => setParam({ client_id: id })}
                      />
                    ) : null}
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
          }
          empty={
            filtered ? (
              <EmptyState
                icon={<SearchX className="size-6" />}
                title="No budgets match"
                description="Try a different search, status, manager or client."
                action={<Button onClick={clearAll}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={<Gauge className="size-6" />}
                title="No jobs with a budget"
                description="Set an hours or a fee budget on a job and it is tracked here."
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
                  itemLabel={['job', 'jobs']}
                />
              </div>
            ) : undefined
          }
        />
      )}
    </PageShell>
  );
}
