import { History, X } from 'lucide-react';

import { Button, EmptyState, Pagination, Sheet, Skeleton } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatUkDate, formatUkDateTime } from '@/utils/dates';

import { flattenPages, useEntryHistory } from '../api';
import type { TimeEntry } from '../types';
import { changeLines } from '../utils/history';
import { LoadError } from './PageShell';

export interface HistoryDrawerProps {
  /** The entry whose corrections are listed; null closes the drawer. */
  entry: TimeEntry | null;
  onClose: () => void;
}

function Content({ entry, onClose }: { entry: TimeEntry; onClose: () => void }) {
  const { organization } = useOrg();
  const history = useEntryHistory(entry.id);
  const items = flattenPages(history.data);

  return (
    <>
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-base font-semibold text-text">Corrections of this entry</h2>
          <p className="text-xs text-text-muted">
            {entry.client_name ?? 'No client'} · {formatUkDate(entry.entry_date)}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close history" onClick={onClose}>
          <X className="size-5" aria-hidden="true" />
        </Button>
      </header>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {history.isError && !history.data ? (
          <LoadError
            title="Could not load the history"
            error={history.error}
            onRetry={() => void history.refetch()}
            retrying={history.isRefetching}
          />
        ) : history.isPending ? (
          <div role="status" aria-label="Loading the history">
            <Skeleton lines={4} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<History className="size-6" />}
            title="No corrections yet"
            description="When approved time is corrected, the reason, who did it and the before and after are kept here."
          />
        ) : (
          <>
            <ol className="flex flex-col gap-3">
              {items.map((item) => (
                <li key={item.id} className="rounded-lg border border-border bg-surface p-3.5">
                  <p className="text-xs text-text-muted">
                    <span className="font-semibold text-text">
                      {item.corrected_by_name ?? 'Someone'}
                    </span>{' '}
                    corrected it on {formatUkDateTime(item.created_at, organization.timezone)}
                  </p>
                  <p className="mt-1.5 text-sm text-text">
                    <span className="font-medium">Reason:</span> {item.reason}
                  </p>
                  <table className="mt-2 w-full text-xs">
                    <caption className="sr-only">
                      Changes made on {formatUkDateTime(item.created_at, organization.timezone)}
                    </caption>
                    <thead>
                      <tr className="text-left text-text-muted">
                        <th scope="col" className="pr-3 pb-1 font-medium">
                          Field
                        </th>
                        <th scope="col" className="pr-3 pb-1 font-medium">
                          Before
                        </th>
                        <th scope="col" className="pb-1 font-medium">
                          After
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {changeLines(item, organization.currency).map((line) => (
                        <tr key={line.field} className="border-t border-row-border align-top">
                          <th scope="row" className="py-1 pr-3 text-left font-medium text-text">
                            {line.label}
                          </th>
                          <td className="py-1 pr-3 text-text-muted line-through">{line.before}</td>
                          <td className="py-1 font-medium text-text">{line.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </li>
              ))}
            </ol>
            <Pagination
              hasMore={history.hasNextPage}
              onLoadMore={() => void history.fetchNextPage()}
              loading={history.isFetchingNextPage}
              count={items.length}
              itemLabel={['correction', 'corrections']}
            />
          </>
        )}
      </div>
    </>
  );
}

/** The corrections of one entry, newest first: who, when, why, and what changed. */
export function HistoryDrawer({ entry, onClose }: HistoryDrawerProps) {
  return (
    <Sheet
      open={entry !== null}
      onClose={onClose}
      label="Corrections of the time entry"
      className="ml-auto max-w-lg"
    >
      {entry ? <Content key={entry.id} entry={entry} onClose={onClose} /> : null}
    </Sheet>
  );
}
