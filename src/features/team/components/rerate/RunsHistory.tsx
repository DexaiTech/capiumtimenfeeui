import { History } from 'lucide-react';
import { useState } from 'react';

import { EmptyState, Pagination, Select, Table, type TableColumn } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { formatUkDateTime } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { flattenPages, useRerunItems, useReruns } from '../../api';
import type { Rerun, RerunItemOutcome } from '../../types';
import { formatDelta, describeRunScope } from '../../utils/rerate';
import { LoadError } from '../PageShell';
import { EntryTable, type EntryRow } from './EntryTable';

const SOURCE_LABEL: Record<string, string> = {
  rerate: 'Re-rate',
  revalue: 'Re-valuation (V1)',
};

const OUTCOMES: ReadonlyArray<{ value: '' | RerunItemOutcome; label: string }> = [
  { value: '', label: 'All entries' },
  { value: 'changed', label: 'Changed' },
  { value: 'skipped', label: 'Left alone' },
];

/** The entries one run changed or left alone, with the rates they had and got. */
function RunItems({ run, showCost }: { run: Rerun; showCost: boolean }) {
  const [outcome, setOutcome] = useState<'' | RerunItemOutcome>('');
  const items = useRerunItems(run.id, outcome || undefined);
  const rows: EntryRow[] = flattenPages(items.data).map((item) => ({ key: item.id, ...item }));

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      <Select
        label="Show"
        options={OUTCOMES}
        value={outcome}
        onChange={(event) => setOutcome(event.target.value as '' | RerunItemOutcome)}
        className="max-w-48"
      />
      {items.isError && !items.data ? (
        <LoadError
          title="Could not load the entries of this re-rate"
          error={items.error}
          onRetry={() => void items.refetch()}
          retrying={items.isRefetching}
        />
      ) : (
        <EntryTable
          caption="Entries of the re-rate"
          rows={rows}
          showCost={showCost}
          tense="applied"
          loading={items.isPending}
          empty={
            <EmptyState
              title="No entries"
              description="This re-rate has no entries of that kind."
            />
          }
          footer={
            rows.length > 0 ? (
              <div className="border-t border-row-border px-4 py-2">
                <Pagination
                  hasMore={items.hasNextPage}
                  onLoadMore={() => void items.fetchNextPage()}
                  loading={items.isFetchingNextPage}
                  count={rows.length}
                  itemLabel={['entry', 'entries']}
                />
              </div>
            ) : null
          }
        />
      )}
    </div>
  );
}

/**
 * The re-rates applied so far, newest first (needs `rate.read`). A row opens to the entries it
 * changed or left alone; V1 re-valuations are listed too.
 */
export function RunsHistory() {
  const { organization, can } = useOrg();
  const showCost = can(PERMISSIONS.rateRead);
  const runs = useReruns();
  const loaded = flattenPages(runs.data);
  const when = (run: Rerun) => formatUkDateTime(run.created_at, organization.timezone);

  const columns: TableColumn<Rerun>[] = [
    {
      id: 'when',
      header: 'When',
      card: 'title',
      className: 'w-44 whitespace-nowrap',
      cell: (run) => <span className="font-medium text-text">{when(run)}</span>,
    },
    {
      id: 'who',
      header: 'Who',
      className: 'w-40',
      cell: (run) => <span className="text-text">{run.requested_by_name ?? '—'}</span>,
    },
    {
      id: 'kind',
      header: 'Kind',
      className: 'w-40 whitespace-nowrap',
      cell: (run) => (
        <span className="text-text-muted">{SOURCE_LABEL[run.source] ?? run.source}</span>
      ),
    },
    {
      id: 'scope',
      header: 'Scope',
      className: 'min-w-64',
      cell: (run) => <span className="text-text">{describeRunScope(run.scope)}</span>,
    },
    {
      id: 'entries',
      header: 'Entries',
      className: 'w-52 whitespace-nowrap',
      cell: (run) => (
        <span className="text-text">
          {run.entries_changed} changed · {run.entries_skipped} left alone
        </span>
      ),
    },
    {
      id: 'value',
      header: 'Charge-out value',
      align: 'end',
      className: 'w-64 whitespace-nowrap',
      cell: (run) => (
        <span className="text-text tabular-nums">
          {formatMoney(run.charge_value_before)} → {formatMoney(run.charge_value_after)} (
          {formatDelta(run.charge_value_delta)})
        </span>
      ),
    },
    ...(showCost
      ? [
          {
            id: 'cost',
            header: 'Cost value',
            align: 'end' as const,
            className: 'w-32 whitespace-nowrap',
            cell: (run: Rerun) => (
              <span className="text-text tabular-nums">{formatDelta(run.cost_value_delta)}</span>
            ),
          },
        ]
      : []),
    {
      id: 'note',
      header: 'Note',
      className: 'min-w-40',
      cell: (run) =>
        run.note ? (
          <span className="text-text">{run.note}</span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
  ];

  return (
    <section aria-labelledby="rerate-history" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="rerate-history" className="text-base font-semibold text-text">
          Earlier re-rates
        </h2>
        <p className="text-sm text-text-muted">
          Every re-rate that was applied, newest first. Open one to see the entries it changed.
        </p>
      </div>
      {runs.isError && !runs.data ? (
        <LoadError
          title="Could not load the earlier re-rates"
          error={runs.error}
          onRetry={() => void runs.refetch()}
          retrying={runs.isRefetching}
        />
      ) : (
        <>
          <Table
            caption="Earlier re-rates"
            columns={columns}
            rows={loaded}
            rowKey={(run) => run.id}
            loading={runs.isPending}
            expansion={{
              label: (run) => `Entries of the re-rate of ${when(run)}`,
              render: (run) => <RunItems run={run} showCost={showCost} />,
            }}
            empty={
              <EmptyState
                icon={<History className="size-6" />}
                title="No re-rates yet"
                description="When a re-rate is applied it is kept here, with who did it and what it changed."
              />
            }
          />
          {loaded.length > 0 ? (
            <Pagination
              hasMore={runs.hasNextPage}
              onLoadMore={() => void runs.fetchNextPage()}
              loading={runs.isFetchingNextPage}
              count={loaded.length}
              itemLabel={['re-rate', 're-rates']}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
