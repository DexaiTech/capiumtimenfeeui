import { History, ScrollText } from 'lucide-react';

import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  InitialsAvatar,
  Pagination,
  Skeleton,
} from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { isApiError } from '@/services/api';
import { cn } from '@/utils/cn';
import { formatUkDateTime } from '@/utils/dates';
import { formatRelativeTime } from '@/utils/format';

import { flattenPages, useRecordHistory } from '../api/hooks';
import type { HistoryEntry } from '../types';
import { subjectOf } from '../utils/format';
import { ChangesTable } from './ChangesTable';

export interface RecordHistoryProps {
  /** The record's type as it appears in the audit entries: `client`, `job`, `invoice` … */
  targetType: string;
  targetId: string;
  /** The card's heading. */
  title?: string;
  /** For a client: also what names it (its contacts, jobs, invoices, payments …). */
  includeRelated?: boolean;
  className?: string;
}

function Actor({ entry }: { entry: HistoryEntry }) {
  if (!entry.actor) {
    return (
      <span
        role="img"
        aria-label="System"
        title="System"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-hover text-text-muted"
      >
        <ScrollText aria-hidden="true" className="size-4" />
      </span>
    );
  }
  return <InitialsAvatar name={entry.actor.name} colorKey={entry.actor.id} size="sm" />;
}

function Entry({ entry, timeZone }: { entry: HistoryEntry; timeZone: string }) {
  const exact = formatUkDateTime(entry.at, timeZone);
  const subject = subjectOf(entry);
  return (
    <li className="flex gap-3 px-5 py-4">
      <Actor entry={entry} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-text">{entry.label}</span>
          <span className="text-xs text-text-muted">
            <time dateTime={entry.at} title={exact}>
              {formatRelativeTime(entry.at) || exact}
            </time>
            {' · '}
            {exact}
          </span>
        </div>
        <p className="text-xs text-text-muted">
          <span className="font-medium text-text">{entry.actor?.name ?? 'System'}</span>
          {subject ? <> · {subject}</> : null}
        </p>
        {entry.changes.length > 0 ? (
          <ChangesTable
            changes={entry.changes}
            caption={`Changes made on ${exact}`}
            className="mt-1 rounded-lg border border-border bg-surface px-3 py-2"
          />
        ) : null}
        {entry.ip_address ? (
          <p className="text-xs text-text-subtle">
            IP address <span className="font-mono">{entry.ip_address}</span>
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The history of one record: a timeline, newest first, of who did what and when, with the
 * before and after of every field an action changed. Whoever reads the audit log also sees the
 * IP address of each entry. The API decides what the caller may see (403 without the record's
 * read permission or `audit_log.read`).
 */
export function RecordHistory({
  targetType,
  targetId,
  title = 'History',
  includeRelated = false,
  className,
}: RecordHistoryProps) {
  const { organization } = useOrg();
  const history = useRecordHistory({ targetType, targetId, includeRelated });
  const entries = flattenPages(history.data);

  return (
    <Card padding="none" className={cn('min-w-0', className)}>
      <CardHeader title={title} description="Who changed this record, when, and what changed." />
      {history.isError && !history.data ? (
        <ErrorState
          title="Could not load the history"
          error={isApiError(history.error) ? history.error : null}
          onRetry={() => void history.refetch()}
          retrying={history.isRefetching}
          className="py-10"
        />
      ) : history.isPending ? (
        <div role="status" aria-label="Loading the history" className="px-5 py-4">
          <Skeleton lines={4} />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<History className="size-6" />}
          title="No history yet"
          description="Changes to this record are recorded here as they happen."
          size="compact"
        />
      ) : (
        <>
          <ol aria-label={`${title} entries`} className="divide-y divide-row-border">
            {entries.map((entry) => (
              <Entry key={entry.id} entry={entry} timeZone={organization.timezone} />
            ))}
          </ol>
          <Pagination
            hasMore={history.hasNextPage}
            onLoadMore={() => void history.fetchNextPage()}
            loading={history.isFetchingNextPage}
            count={entries.length}
            itemLabel={['entry', 'entries']}
            loadMoreLabel="Load older entries"
            endLabel="Start of the history"
            className="border-t border-row-border px-5 py-3"
          />
        </>
      )}
    </Card>
  );
}
