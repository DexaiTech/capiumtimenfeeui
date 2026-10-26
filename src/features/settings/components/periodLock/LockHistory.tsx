import { History, Lock } from 'lucide-react';

import { Badge, DataTable, EmptyState, Pagination, type DataTableColumn } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatUkDateTime } from '@/utils/dates';

import { flattenPages, usePeriodLockHistory } from '../../api/adminHooks';
import type { PeriodLockEvent } from '../../adminTypes';
import { describeEvent } from '../../utils/periodLock';
import { LoadError } from '../LoadError';

/** Every lock and unlock, newest first: the history is append-only. */
export function LockHistory() {
  const { organization } = useOrg();
  const history = usePeriodLockHistory();
  const rows = flattenPages(history.data);

  const columns: DataTableColumn<PeriodLockEvent>[] = [
    {
      id: 'when',
      header: 'When',
      hideable: false,
      className: 'whitespace-nowrap',
      cell: (event) => (
        <span className="text-text">
          {formatUkDateTime(event.created_at, organization.timezone)}
        </span>
      ),
    },
    {
      id: 'action',
      header: 'Change',
      className: 'min-w-48',
      cell: (event) => {
        const change = describeEvent(event);
        return (
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <Badge tone={event.event_type === 'locked' ? 'warning' : 'info'} size="sm">
                {event.event_type === 'locked' ? 'Locked' : 'Unlocked'}
              </Badge>
              <span className="font-medium text-text">{change.title}</span>
            </span>
            {change.detail ? (
              <span className="text-xs text-text-muted">{change.detail}</span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'by',
      header: 'By',
      className: 'whitespace-nowrap',
      cell: (event) => <span className="text-text">{event.actor_name ?? 'Unknown'}</span>,
    },
    {
      id: 'reason',
      header: 'Reason',
      className: 'min-w-48 max-w-96',
      cell: (event) =>
        event.reason ? (
          <span className="text-text">{event.reason}</span>
        ) : (
          <span className="text-text-subtle">—</span>
        ),
    },
  ];

  if (history.isError && !history.data) {
    return (
      <LoadError
        title="Could not load the history"
        error={history.error}
        onRetry={() => void history.refetch()}
        retrying={history.isRefetching}
      />
    );
  }

  return (
    <section aria-label="Lock history" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <History aria-hidden="true" className="size-4 text-text-muted" />
        <h2 className="text-base font-semibold text-text">History</h2>
      </div>
      <DataTable
        caption="Lock history"
        columns={columns}
        rows={rows}
        rowKey={(event) => event.id}
        loading={history.isPending}
        empty={
          <EmptyState
            icon={<Lock className="size-6" />}
            title="Nothing has been locked yet"
            description="Every lock and every unlock is listed here, with who did it and why."
          />
        }
      />
      {rows.length > 0 ? (
        <Pagination
          hasMore={history.hasNextPage}
          onLoadMore={() => void history.fetchNextPage()}
          loading={history.isFetchingNextPage}
          count={rows.length}
          itemLabel={['change', 'changes']}
          loadMoreLabel="Load older changes"
          endLabel="Start of the history"
        />
      ) : null}
    </section>
  );
}
