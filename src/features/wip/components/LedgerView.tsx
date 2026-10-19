import { BookOpen, SearchX } from 'lucide-react';

import {
  Badge,
  Button,
  CountTabs,
  DataTable,
  DateRangeField,
  EmptyState,
  PageToolbar,
  Pagination,
  type DataTableColumn,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { ClientPicker, JobPicker } from '@/features/team';
import { useUrlParams } from '@/hooks';
import { cn } from '@/utils/cn';
import { formatUkDate } from '@/utils/dates';

import { flattenPages, useLedger } from '../api';
import { COMPONENT_LABEL, MOVEMENT_KIND_META } from '../constants';
import type { LedgerFilters, Movement, MovementSource } from '../types';
import { isoDate, jobText, personName, signedMoney } from '../utils/format';
import { FilterPopover } from './FilterPopover';
import { LoadError } from './PageShell';

type Tab = 'all' | MovementSource;

/** The item write-offs are not here: they are not ledger movements (see `WriteOffsView`). */
const TABS: ReadonlyArray<{ value: Tab; label: string }> = [
  { value: 'all', label: 'All movements' },
  { value: 'adjustment', label: 'Adjustments' },
  { value: 'transfer', label: 'Transfers' },
  { value: 'credit_note', label: 'Credit notes' },
];

function ledgerColumns(currency: string): DataTableColumn<Movement>[] {
  return [
    {
      id: 'date',
      header: 'Effective',
      className: 'whitespace-nowrap',
      cell: (row) => <span className="text-text">{formatUkDate(row.effective_date)}</span>,
    },
    {
      id: 'client',
      header: 'Client',
      className: 'min-w-40 max-w-64',
      cell: (row) => (
        <span className="block truncate text-text" title={row.client?.name}>
          {row.client?.name ?? '—'}
        </span>
      ),
    },
    {
      id: 'job',
      header: 'Job',
      className: 'min-w-40 max-w-64',
      cell: (row) => (
        <span className="block truncate text-text" title={jobText(row.job)}>
          {jobText(row.job)}
        </span>
      ),
    },
    {
      id: 'movement',
      header: 'Movement',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <div className="flex flex-col items-start gap-0.5">
          <span className="flex items-center gap-1.5">
            <Badge tone={MOVEMENT_KIND_META[row.kind].tone} size="sm">
              {MOVEMENT_KIND_META[row.kind].label}
            </Badge>
            {row.reversed ? (
              <Badge tone="grey" size="sm">
                Reversed
              </Badge>
            ) : null}
          </span>
          <span className="text-xs text-text-muted">{COMPONENT_LABEL[row.component]} WIP</span>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (row) =>
        row.scope === 'items' ? (
          <span className="text-xs text-text-muted">
            {row.item_count === 1 ? '1 item' : `${String(row.item_count)} items`}
          </span>
        ) : (
          <span
            className={cn(
              'font-semibold tabular-nums',
              row.amount >= 0 ? 'text-success' : 'text-danger',
            )}
          >
            {signedMoney(row.amount, currency)}
          </span>
        ),
    },
    {
      id: 'reason',
      header: 'Reason',
      className: 'min-w-56 max-w-96',
      cell: (row) => (
        <span className="block truncate text-text" title={row.reason}>
          {row.reason}
        </span>
      ),
    },
    {
      id: 'actor',
      header: 'By',
      className: 'whitespace-nowrap',
      cell: (row) => <span className="text-text">{personName(row.actor)}</span>,
    },
  ];
}

/** Every WIP movement, newest first: the ledger is append-only, a correction is a reversal. */
export function LedgerView() {
  const { organization, can } = useOrg();
  const { params, setParam } = useUrlParams();

  const tab: Tab = TABS.find((item) => item.value === params.get('source'))?.value ?? 'all';
  const clientId = params.get('client_id');
  const jobId = params.get('job_id');
  const from = isoDate(params.get('date_from'));
  const to = isoDate(params.get('date_to'));

  const filters: LedgerFilters = {
    source_type: tab === 'all' ? undefined : tab,
    client_id: clientId ?? undefined,
    job_id: jobId ?? undefined,
    date_from: from ?? undefined,
    date_to: to ?? undefined,
  };
  const list = useLedger(filters);
  const rows = flattenPages(list.data);

  const currency = organization.currency;
  const activeFilters =
    Number(clientId !== null) +
    Number(jobId !== null) +
    Number(from !== null) +
    Number(to !== null);
  const filtered = tab !== 'all' || activeFilters > 0;

  const clearAll = () =>
    setParam({ source: null, client_id: null, job_id: null, date_from: null, date_to: null });

  return (
    <>
      {list.isError && !list.data ? (
        <LoadError
          title="Could not load the ledger"
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : (
        <DataTable
          caption="WIP ledger"
          columns={ledgerColumns(currency)}
          rows={rows}
          rowKey={(row) => row.id}
          loading={list.isPending}
          toolbar={
            <PageToolbar
              start={
                <CountTabs
                  label="Where the movement came from"
                  items={TABS}
                  value={tab}
                  onChange={(value) => setParam({ source: value === 'all' ? null : value })}
                />
              }
              actions={
                <FilterPopover title="Filter the ledger" count={activeFilters} onClear={clearAll}>
                  {can(PERMISSIONS.clientRead) ? (
                    <ClientPicker
                      label="Client"
                      clearable
                      value={clientId}
                      onChange={(id) => setParam({ client_id: id, job_id: null })}
                    />
                  ) : null}
                  {can(PERMISSIONS.jobRead) ? (
                    <JobPicker
                      label="Job"
                      clearable
                      value={jobId}
                      clientId={clientId}
                      onChange={(job) => setParam({ job_id: job?.id ?? null })}
                    />
                  ) : null}
                  <DateRangeField
                    label="Effective date"
                    value={{ from, to }}
                    onChange={(range) => setParam({ date_from: range.from, date_to: range.to })}
                  />
                </FilterPopover>
              }
            />
          }
          empty={
            filtered ? (
              <EmptyState
                icon={<SearchX className="size-6" />}
                title="No movements match"
                description="Try a different source, client, job or dates."
                action={<Button onClick={clearAll}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={<BookOpen className="size-6" />}
                title="The ledger is empty"
                description="Adjustments, transfers and credit notes that change the WIP are recorded here."
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
                  itemLabel={['movement', 'movements']}
                />
              </div>
            ) : undefined
          }
        />
      )}
    </>
  );
}
