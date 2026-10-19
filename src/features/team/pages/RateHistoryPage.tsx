import { Download, History, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  Button,
  ColumnVisibilityMenu,
  CountTabs,
  DataTable,
  DateRangeField,
  EmptyState,
  PageToolbar,
  Pagination,
  Select,
  type DataTableColumn,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, useUrlParams } from '@/hooks';
import { downloadText, toCsv } from '@/utils/csv';
import { formatUkDateTime } from '@/utils/dates';

import { flattenPages, useGradeOptions, useRateHistory, useServices } from '../api';
import { ChangeActionBadge } from '../components/badges';
import { FilterPopover } from '../components/FilterPopover';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { ClientPicker } from '../components/pickers/ClientPicker';
import { StaffPicker } from '../components/pickers/StaffPicker';
import { CHANGE_ACTION_LABEL, CHANGE_SOURCE_LABEL, RATE_KIND_LABEL } from '../constants';
import type { ChangeAction, RateChange, RateHistoryFilters, RateKind } from '../types';
import { summariseChange } from '../utils/history';

type KindTab = 'all' | RateKind;
const TABS: ReadonlyArray<{ value: KindTab; label: string }> = [
  { value: 'all', label: 'All changes' },
  { value: 'charge', label: 'Charge-out' },
  { value: 'cost', label: 'Cost' },
];
const ACTIONS = Object.keys(CHANGE_ACTION_LABEL) as ChangeAction[];

function HistoryList() {
  const { organization, can } = useOrg();
  const { params, setParam } = useUrlParams();

  // Everything the list is narrowed by lives in the URL, so the rate lists can link here.
  const kindParam = params.get('kind');
  const tab: KindTab = TABS.find((item) => item.value === kindParam)?.value ?? 'all';
  const action = ACTIONS.find((item) => item === params.get('action')) ?? '';
  const staffId = params.get('staff') ?? '';
  const gradeId = params.get('grade') ?? '';
  const clientId = params.get('client') ?? '';
  const serviceId = params.get('service') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';

  // The pickers read staff, grades and clients, which have their own permissions.
  const canPickPeople = can(PERMISSIONS.memberRead);
  const canPickClient = can(PERMISSIONS.clientRead);

  const filters = useMemo<RateHistoryFilters>(
    () => ({
      kind: tab === 'all' ? undefined : tab,
      action: action || undefined,
      user_id: staffId || undefined,
      grade_id: gradeId || undefined,
      client_id: clientId || undefined,
      service_id: serviceId || undefined,
      date_from: from || undefined,
      date_to: to || undefined,
    }),
    [tab, action, staffId, gradeId, clientId, serviceId, from, to],
  );
  const history = useRateHistory(filters);
  const grades = useGradeOptions({ enabled: canPickPeople });
  const services = useServices();

  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());

  const filterCount = [action, staffId, gradeId, clientId, serviceId, from, to].filter(
    Boolean,
  ).length;
  const filtered = tab !== 'all' || filterCount > 0;
  const clearFilters = () =>
    setParam({
      action: null,
      staff: null,
      grade: null,
      client: null,
      service: null,
      from: null,
      to: null,
    });

  const when = (change: RateChange) => formatUkDateTime(change.at, organization.timezone);

  const columns: DataTableColumn<RateChange>[] = [
    {
      id: 'when',
      header: 'When',
      hideable: false,
      className: 'w-44 whitespace-nowrap',
      cell: (change) => <span className="text-text">{when(change)}</span>,
    },
    {
      id: 'who',
      header: 'Who',
      className: 'w-44',
      cell: (change) => (
        <span className="text-text">
          {change.actor_name ?? <span className="text-text-muted">—</span>}
        </span>
      ),
    },
    {
      id: 'what',
      header: 'What changed',
      className: 'w-52',
      cell: (change) => (
        <div className="flex flex-col items-start gap-1">
          <ChangeActionBadge action={change.action} />
          <span className="text-xs text-text-muted">
            {RATE_KIND_LABEL[change.kind]} · {change.level_label}
          </span>
        </div>
      ),
    },
    {
      id: 'applies',
      header: 'Applies to',
      cell: (change) => <span className="text-text">{summariseChange(change).scope || '—'}</span>,
    },
    {
      id: 'change',
      header: 'Rate and period',
      className: 'min-w-64',
      cell: (change) => {
        const summary = summariseChange(change);
        return (
          <div className="flex flex-col">
            <span className="font-medium text-text tabular-nums">{summary.rate}</span>
            <span className="text-xs text-text-muted">{summary.period}</span>
          </div>
        );
      },
    },
    {
      id: 'source',
      header: 'Source',
      className: 'w-44 whitespace-nowrap',
      cell: (change) => (
        <span className="text-text-muted">
          {CHANGE_SOURCE_LABEL[change.source] ?? change.source}
        </span>
      ),
    },
  ];

  const loaded = flattenPages(history.data);

  const exportCsv = () => {
    const csv = toCsv([
      ['When', 'Who', 'Change', 'Kind', 'Level', 'Applies to', 'Rate', 'Period', 'Source'],
      ...loaded.map((change) => {
        const summary = summariseChange(change);
        return [
          when(change),
          change.actor_name,
          CHANGE_ACTION_LABEL[change.action],
          RATE_KIND_LABEL[change.kind],
          change.level_label,
          summary.scope,
          summary.rate,
          summary.period,
          CHANGE_SOURCE_LABEL[change.source] ?? change.source,
        ];
      }),
    ]);
    downloadText(`${organization.slug}-rate-history.csv`, csv);
  };

  if (history.isError && !history.data) {
    return (
      <LoadError
        title="Could not load the rate history"
        error={history.error}
        onRetry={() => void history.refetch()}
        retrying={history.isRefetching}
      />
    );
  }

  const gradeOptions = [
    { value: '', label: 'All grades' },
    ...(grades.data ?? []).map((grade) => ({ value: grade.id, label: grade.name })),
  ];
  const serviceOptions = [
    { value: '', label: 'All services' },
    ...(services.data ?? []).map((service) => ({ value: service.id, label: service.name })),
  ];
  const actionOptions = [
    { value: '', label: 'Any change' },
    ...ACTIONS.map((item) => ({ value: item, label: CHANGE_ACTION_LABEL[item] })),
  ];

  return (
    <DataTable
      caption="Rate changes"
      columns={columns}
      rows={loaded}
      rowKey={(change) => change.id}
      hiddenColumns={hidden}
      loading={history.isPending}
      toolbar={
        <PageToolbar
          start={
            <CountTabs
              label="Kinds of rate"
              items={TABS}
              value={tab}
              onChange={(value) => setParam({ kind: value === 'all' ? null : value })}
            />
          }
          actions={
            <>
              <ColumnVisibilityMenu
                columns={columns.map((column) => ({
                  id: column.id,
                  label: column.header,
                  locked: column.hideable === false,
                }))}
                hidden={hidden}
                onChange={setHidden}
              />
              <FilterPopover title="Filter rate changes" count={filterCount} onClear={clearFilters}>
                <Select
                  label="Type of change"
                  options={actionOptions}
                  value={action}
                  onChange={(event) => setParam({ action: event.target.value })}
                />
                {canPickPeople ? (
                  <StaffPicker
                    label="Staff member"
                    value={staffId || null}
                    onChange={(id) => setParam({ staff: id })}
                    includeLeft
                    placeholder="Anyone"
                  />
                ) : null}
                {canPickPeople ? (
                  <Select
                    label="Grade"
                    options={gradeOptions}
                    value={gradeId}
                    onChange={(event) => setParam({ grade: event.target.value })}
                  />
                ) : null}
                {canPickClient ? (
                  <ClientPicker
                    label="Client"
                    value={clientId || null}
                    onChange={(id) => setParam({ client: id })}
                    placeholder="Any client"
                  />
                ) : null}
                <Select
                  label="Service"
                  options={serviceOptions}
                  value={serviceId}
                  onChange={(event) => setParam({ service: event.target.value })}
                />
                <DateRangeField
                  label="Changed on"
                  value={{ from: from || null, to: to || null }}
                  onChange={(range) => setParam({ from: range.from, to: range.to })}
                />
              </FilterPopover>
              <Button
                variant="brand-outline"
                size="sm"
                leftIcon={<Download aria-hidden="true" className="size-4" />}
                onClick={exportCsv}
                disabled={loaded.length === 0}
              >
                Export
              </Button>
            </>
          }
        />
      }
      empty={
        filtered ? (
          <EmptyState
            icon={<SearchX className="size-6" />}
            title="No changes match"
            description="Try another kind of rate or fewer filters."
            action={
              <Button
                onClick={() => {
                  setParam({ kind: null });
                  clearFilters();
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<History className="size-6" />}
            title="No rate changes yet"
            description="Every rate that is added, changed, end-dated or deleted is recorded here, with who did it."
          />
        )
      }
      footer={
        loaded.length > 0 ? (
          <div className="border-t border-row-border px-4 py-2">
            <Pagination
              hasMore={history.hasNextPage}
              onLoadMore={() => void history.fetchNextPage()}
              loading={history.isFetchingNextPage}
              count={loaded.length}
              itemLabel={['change', 'changes']}
            />
          </div>
        ) : null
      }
    />
  );
}

/** `/:orgSlug/team/rate-history`: every change to a rate, newest first (`rate.read`). */
export default function RateHistoryPage() {
  const { can } = useOrg();
  useDocumentTitle('Rate History');
  return (
    <PageShell
      title="Rate History"
      description="Every change to a cost rate, a charge-out rate or a grade's default rate, newest first."
    >
      {can(PERMISSIONS.rateRead) ? <HistoryList /> : <NoAccess what="the rate history" />}
    </PageShell>
  );
}
